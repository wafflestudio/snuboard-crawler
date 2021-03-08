import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { load } from 'cheerio';
import { RequestQueue } from 'apify';
import { Connection } from 'typeorm';
import assert from 'assert';
import * as Apify from 'apify';
import { strptime } from '../micro-strptime';
import { File, Notice } from '../../server/src/notice/notice.entity';
import { absoluteLink, getOrCreate, getOrCreateTags, runCrawler, saveNotice } from '../utils';
import { CategoryTag, SiteData, CategoryCrawlerInit } from '../types/custom-types';
import { Crawler } from './crawler';
import { Department } from '../../server/src/department/department.entity';

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

        if ($) {
            // creation order
            // dept -> notice -> file
            //                -> tag -> notice_tag

            const notice = await getOrCreate(Notice, { link: url }, false);

            notice.department = siteData.department;
            notice.title = $('dl.cHeader dt').text().trim();
            const contentElement = $('div.postArea');
            let content = contentElement.html() ?? '';
            content = load(content, { decodeEntities: false })('body').html() ?? '';
            // ^ encode non-unicode letters with utf-8 instead of HTML encoding
            notice.content = content;
            notice.preview = contentElement.text().substring(0, 1000).trim(); // texts are automatically utf-8 encoded
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
            const category: string = url.split('/')[5];
            if (this.categoryTags[category] && !tags.includes(this.categoryTags[category])) {
                tags.push(this.categoryTags[category]);
            }
            tags = tags.filter((tag) => tag !== this.excludedTag);
            await getOrCreateTags(tags, notice, siteData.department);
        }
    };

    handleList = async (context: CheerioHandlePageInputs, requestQueue: RequestQueue): Promise<void> => {
        const { request, $ } = context;
        const { url } = request;
        const siteData = <SiteData>request.userData;
        this.log.info('Page opened.', { url });
        if ($) {
            const urlInstance = new URL(url);
            const page: number = +(urlInstance.pathname.split('/')[5] ?? 1);
            // example:  /ko/board/Scholarship/page/2 => ['', 'ko', 'board', 'Scholarship','page','2']

            $('table.lc01 tbody tr').each((index, element) => {
                const isPinned = $(element).children('td').first().text().trim() === '공지';
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
                };
                this.log.info('Enqueueing', { link });
                requestQueue.addRequest({
                    url: link,
                    userData: newSiteData,
                });
            });

            const nextPath = urlInstance.pathname.split('/').slice(0, 4).join('/');

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
                };
                await this.addVaryingRequest(requestQueue, {
                    url: nextList,
                    userData: nextListSiteData,
                });
            }
        }
    };

    startCrawl = async (connection: Connection): Promise<void> => {
        assert(connection.isConnected);
        this.log.info('Starting crawl for '.concat(this.departmentName));
        const requestQueue = await Apify.openRequestQueue(this.departmentCode); // each queue should have different id
        const department = await getOrCreate(Department, {
            name: this.departmentName,
            college: this.departmentCollege,
        });

        // department-specific initialization urls
        const siteData: SiteData = { department, isList: true, isPinned: false, dateString: '' };
        const categories: string[] = Object.keys(this.categoryTags);

        await Promise.all(
            categories.map(async (category) => {
                await this.addVaryingRequest(requestQueue, {
                    url: this.baseUrl + category,
                    userData: siteData,
                });
            }),
        );

        await runCrawler(requestQueue, this.handlePage, this.handleList);
    };
}
