import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { load } from 'cheerio';
import { RequestQueue } from 'apify';
import { Connection } from 'typeorm';
import assert from 'assert';
import * as Apify from 'apify';
import { CategoryCrawler } from '../../classes/categoryCrawler';
import { ART, INF } from '../../constants';
import { CrawlerOption, SiteData, TitleAndTags } from '../../types/custom-types';
import {
    absoluteLink,
    addDepartmentProperty,
    departmentCode,
    getOrCreate,
    getOrCreateTagsWithMessage,
    parseTitle,
    removeUrlPageParam,
    saveNotice,
} from '../../utils';
import { File, Notice } from '../../../server/src/notice/notice.entity';
import { strptime } from '../../micro-strptime';
import { Department } from '../../../server/src/department/department.entity';
import { createRequestQueueConnection, isBasePushCondition } from '../../database';

class ArtCrawler extends CategoryCrawler {
    handlePage = async (context: CheerioHandlePageInputs): Promise<void> => {
        const { request, $ } = context;
        const { url } = request;
        const siteData = <SiteData>request.userData;

        this.log.info('Page opened.', { url });

        if ($ !== undefined) {
            // creation order
            // dept -> notice -> file
            //                -> tag -> notice_tag

            const notice = await getOrCreate(Notice, { link: url }, false);

            const titleTag = parseTitle($('h1.article-title').text().trim());
            notice.department = siteData.department;
            notice.departmentCode = departmentCode(siteData.department.name);
            notice.title = titleTag.title;
            const contentElement = $('div.entry-content');
            let content = contentElement.html() ?? '';
            content = load(content, { decodeEntities: false })('body').html()?.trim() ?? '';
            // ^ encode non-unicode letters with utf-8 instead of HTML encoding
            notice.content = content;
            notice.contentText = contentElement.text().trim(); // texts are automatically utf-8 encoded
            const fullDateString: string = siteData.dateString.replace(/\s/g, '');
            // example: '2021/02/26'
            notice.createdAt = strptime(fullDateString, '%Y/%m/%d');

            notice.isPinned = siteData.isPinned;

            notice.link = url;

            await saveNotice(notice);

            const files: File[] = [];
            $('li.down-items a').each((index, element) => {
                const fileUrl = $(element).attr('href');
                if (fileUrl) {
                    const file = new File();
                    [file.name] = fileUrl.split('/').slice(-1);
                    file.link = fileUrl;
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
            const tags: string[] = [this.categoryTags[siteData.tag ?? ''] ?? '공지사항'];
            if (titleTag.tags[0]) {
                titleTag.tags[0].split('/').forEach((element) => {
                    tags.push(element);
                });
            }

            await getOrCreateTagsWithMessage(tags, notice, siteData.department);
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
            // http://art.snu.ac.kr/notice/page/119/?catemenu=Notice&type=Events
            // get the page from the second element starts from the last
            const page: number = +url.split('/').slice(-2)[0];

            $('table#posttextlist tr').each((index, element) => {
                const isPinned = !$(element).hasClass('hentry');

                if (isPinned && page > 1) return;

                const titleElement = $(element).find('td.ttitle a');
                // const title = titleElement.text();

                const link = titleElement.attr('href');
                if (link === undefined) return;

                const dateString = $(element).find('td.tdate').text().trim();

                const newSiteData: SiteData = {
                    department: siteData.department,
                    isPinned,
                    isList: false,
                    dateString,
                    commonUrl: siteData.commonUrl,
                    tag: siteData.tag,
                };
                this.log.info('Enqueueing', { link });
                requestQueue.addRequest({
                    url: link,
                    userData: newSiteData,
                });
            });

            if (siteData.tag === undefined) return;
            const nextList = `http://art.snu.ac.kr/${siteData.tag}/page/${page + 1}/?catemenu=${
                siteData.tag === 'notice' ? 'Notice' : 'News'
            }&type=Events`;
            if ($('a.nextpostslink').length !== 0) {
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
        await addDepartmentProperty(department, this);
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
                    const categoryUrl = `${this.baseUrl + category}/page/1/?catemenu=${
                        category === 'notice' ? 'Notice' : 'News'
                    }&type=Events`;
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

export const art = new ArtCrawler({
    departmentName: '미술대학',
    departmentCode: 'art',
    departmentCollege: ART,
    baseUrl: 'http://art.snu.ac.kr/',
    categoryTags: {
        // 'category/college-of-fine-arts': '뉴스',
        notice: '공지사항',
    },
});
