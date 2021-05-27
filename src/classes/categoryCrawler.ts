import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { load } from 'cheerio';
import * as Apify from 'apify';
import { RequestQueue } from 'apify';
import { Connection } from 'typeorm';
import assert from 'assert';
import { strptime } from '../micro-strptime';
import { File, Notice } from '../../server/src/notice/notice.entity';
import { absoluteLink, getOrCreate, getOrCreateTags, saveNotice } from '../utils';
import { CategoryCrawlerInit, CategoryTag, CrawlerOption, SiteData } from '../types/custom-types';
import { Crawler } from './crawler';
import { Department } from '../../server/src/department/department.entity';
import { createRequestQueueConnection, isBasePushCondition, listExists } from '../database';

export class CategoryCrawler extends Crawler {
    protected readonly categoryTags: CategoryTag;

    protected readonly excludedTag?: string;

    constructor(initData: CategoryCrawlerInit) {
        super(initData);
        this.categoryTags = initData.categoryTags;
        this.excludedTag = initData.excludedTag;
    }

    handlePage = async (context: CheerioHandlePageInputs): Promise<void> => {
        const { request, $ } = context;
        const { url } = request;
        const siteData = <SiteData>request.userData;

        this.log.info('Page opened.', { url });

        if ($ !== undefined) {
            // creation order
            // dept -> notice -> file
            //                -> tag -> notice_tag
            $('img').each((index, element) => {
                const imgSrc = $(element).attr('src');
                if (imgSrc && !imgSrc.startsWith('data')) {
                    $(element).attr('src', absoluteLink(imgSrc, this.baseUrl) ?? '');
                }
            });
            const notice = await getOrCreate(Notice, { link: url }, false);

            notice.department = siteData.department;
            notice.title = $('dl.cHeader dt').text().trim();
            const contentElement = $('div.postArea');
            let content = contentElement.html() ?? '';
            content = load(content, { decodeEntities: false })('body').html() ?? '';
            // ^ encode non-unicode letters with utf-8 instead of HTML encoding
            notice.content = content;
            notice.contentText = contentElement.text().trim(); // texts are automatically utf-8 encoded
            const fullDateString: string = $('li.regdate').text().substring(2).trim();
            // example: '2021-02-26 11:34:01'
            notice.createdAt = strptime(fullDateString, '%Y-%m-%d %H:%M:%S');

            notice.isPinned = siteData.isPinned;

            notice.link = url;

            await saveNotice(notice);

            const files: File[] = [];
            $('a.down').each((index, element) => {
                const fileUrl = $(element).attr('href');
                if (fileUrl) {
                    const file = new File();
                    file.name = $(element).text().trim();
                    file.link = absoluteLink(fileUrl, this.baseUrl) ?? '';
                    files.push(file);
                }
            });

            await Promise.all(
                // using Promise.all in order to ensure full execution
                files.map(async (file) => {
                    file.notice = notice;
                    await getOrCreate(File, file);
                }),
            );

            let tags: string[] = [];
            const liCategory = $('li.category');
            if (liCategory.length) {
                liCategory.each((index, element) => {
                    tags.push($(element).text().substring(4).trim());
                });
            }
            const category = siteData.tag;
            if (category && this.categoryTags[category] && !tags.includes(this.categoryTags[category])) {
                tags.push(this.categoryTags[category]);
            }
            tags = tags.filter((tag) => tag !== this.excludedTag);
            await getOrCreateTags(tags, notice, siteData.department);
        } else {
            throw new TypeError('Selector is undefined');
        }
    };

    handleList = async (context: CheerioHandlePageInputs, requestQueue: RequestQueue): Promise<void> => {
        const { request, $ } = context;
        const { url } = request;
        const siteData = <SiteData>request.userData;
        this.log.info('Page opened.', { url });
        if ($ !== undefined) {
            const urlInstance = new URL(url);
            const pageString = urlInstance.pathname.match(/[0-9]+\\?/)?.[0];
            const page: number = +(pageString ?? 1);
            // example:  url~/page/{page}?pmove~ ->

            $('table.lc01 tbody tr').each((index, element) => {
                const noticeNum = $(element).children('td').first().text().trim();
                const isPinned = noticeNum === '공지' || noticeNum === 'Notice';
                if (page > 1 && isPinned) return;

                const titleElement = $($(element).find('a'));
                // const title = titleElement.text();

                const link = absoluteLink(titleElement.attr('href'), request.loadedUrl);
                if (link === undefined) return;
                const dateString = $($(element).children('td')[4]).text().trim();

                const newSiteData: SiteData = {
                    department: siteData.department,
                    isPinned,
                    isList: false,
                    dateString,
                    tag: siteData.tag,
                };
                this.log.info('Enqueueing', { link });
                requestQueue.addRequest({
                    url: link,
                    userData: newSiteData,
                });
            });

            let nextPathArray = urlInstance.pathname.split('/');
            if (pageString) nextPathArray = nextPathArray.slice(0, -2);
            const nextPath = nextPathArray.join('/');

            const nextList = absoluteLink(`${nextPath}/page/${page + 1}`, request.loadedUrl);
            if (!nextList) return;

            const lastNoticeId: string | undefined = $('table.lc01 tbody tr')
                .last()
                .children('td')
                .first()
                .text()
                .trim();
            if (!lastNoticeId || Number.isNaN(+lastNoticeId)) return;

            // +lastNoticeId === 1  <==> loaded page is the last page
            if (+lastNoticeId > 1) {
                this.log.info('Enqueueing list', { nextList });
                const nextListSiteData: SiteData = {
                    department: siteData.department,
                    isPinned: false,
                    isList: true,
                    dateString: '',
                    commonUrl: siteData.commonUrl,
                    tag: siteData.tag,
                };
                await this.addVaryingRequest(
                    requestQueue,
                    {
                        url: nextList,
                        userData: nextListSiteData,
                    },
                    nextListSiteData.commonUrl,
                );
            }
        } else {
            throw new TypeError('Selector is undefined');
        }
    };

    startCrawl = async (connection: Connection, crawlerOption?: CrawlerOption): Promise<void> => {
        assert(connection.isConnected);
        this.log.info('Starting crawl for '.concat(this.departmentName));
        const requestQueue = await Apify.openRequestQueue(this.departmentCode); // each queue should have different id
        const department = await getOrCreate(Department, {
            name: this.departmentName,
            college: this.departmentCollege,
        });
        department.link = this.departmentLink;
        await Department.save(department);
        this.requestQueueDB = await createRequestQueueConnection(this.departmentCode);
        // department-specific initialization urls
        const categories: string[] = Object.keys(this.categoryTags);

        // this must consider about tag. adding tag by using CategoryTag will not work
        if (crawlerOption && crawlerOption.startUrl) {
            const siteData: SiteData = {
                department,
                isList: crawlerOption?.isList ?? true,
                isPinned: false,
                dateString: '',
                commonUrl: null, // crawl-one can only run after all lists are cleared.
                tag: crawlerOption.tag,
            };
            await this.addVaryingRequest(
                requestQueue,
                {
                    url: crawlerOption.startUrl,
                    userData: siteData,
                },
                siteData.commonUrl,
                false,
            );
        } else {
            await Promise.all(
                categories.map(async (category) => {
                    const categoryUrl = this.baseUrl + category;
                    const siteData: SiteData = {
                        department,
                        isList: true,
                        isPinned: false,
                        dateString: '',
                        commonUrl: categoryUrl,
                        tag: category,
                    };
                    assert(this.requestQueueDB !== undefined);
                    if (await isBasePushCondition(this.requestQueueDB, categoryUrl)) {
                        this.log.info(`Adding category ${category}`);
                        await this.addVaryingRequest(
                            requestQueue,
                            {
                                url: categoryUrl,
                                userData: siteData,
                            },
                            siteData.commonUrl,
                            false,
                        );
                    } else {
                        this.log.info(`Skipping adding baseUrl of category ${category}`);
                    }
                }),
            );
        }
        await this.runCrawler(requestQueue, this.handlePage, this.handleList, crawlerOption);
        this.log.info('Crawler Ended');
    };
}
