import { RequestQueue } from 'apify';
import { load } from 'cheerio';
import { CheerioCrawlingContext } from 'crawlee';

import { File, Notice } from '../../../server/src/notice/notice.entity.js';
import { Crawler } from '../../classes/crawler.js';
import { SCIENCE } from '../../constants.js';
import { strptime } from '../../micro-strptime.js';
import { SiteData } from '../../types/custom-types';
import {
    absoluteLink,
    departmentCode,
    getOrCreate,
    getOrCreateTagsWithMessage,
    removeUrlPageParam,
    saveNotice,
} from '../../utils.js';

class MathCrawler extends Crawler {
    handlePage = async (context: CheerioCrawlingContext<SiteData, any>): Promise<void> => {
        const { request, $ } = context;
        const { url } = request;
        const siteData = <SiteData>request.userData;

        this.log.info('Page opened.', { url });

        if ($ !== undefined) {
            // creation order
            // dept -> notice -> file
            //                -> tag -> notice_tag

            const notice = await getOrCreate(Notice, { link: url }, false);

            notice.department = siteData.department;
            notice.departmentCode = departmentCode(siteData.department.name);
            notice.title = $('div.top_area h1 a').text().trim();
            const contentElement = $('div.rd_body div.xe_content');
            const content =
                load(contentElement.html() ?? '', {
                    // @ts-ignore
                    _useHtmlParser2: true,
                    decodeEntities: false,
                })('body').html() ?? '';
            // ^ encode non-unicode letters with utf-8 instead of HTML encoding
            notice.content = content;
            notice.contentText = contentElement.text().trim();
            const dateString: string = $('div.fr span.date').text().trim();
            notice.createdAt = strptime(dateString, '%Y.%m.%d %H:%M');

            notice.isPinned = siteData.isPinned;
            notice.link = url;

            await saveNotice(notice);

            const files: File[] = [];
            $('div.rd_ft table li a').each((index, element) => {
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

            const tags: string[] = [];
            const tag = $('div.top_area strong.cate').text().trim();
            if (tag) {
                tags.push(tag);
            } else {
                tags.push('미분류');
            }
            await getOrCreateTagsWithMessage(tags, notice, siteData.department);
        } else {
            throw new TypeError('Selector is undefined');
        }
    };

    handleList = async (context: CheerioCrawlingContext<SiteData, any>, requestQueue: RequestQueue): Promise<void> => {
        const { request, $ } = context;
        const { url } = request;
        const siteData = <SiteData>request.userData;
        this.log.info('Page opened.', { url });
        if ($ !== undefined) {
            $('table tbody tr').each((index, element) => {
                const titleElement = $(element).find('td.title a').last();
                // const title = titleElement.text();
                if (request.loadedUrl === undefined) throw new TypeError('request.loadedUrl is undefined');
                let link = absoluteLink(titleElement.attr('href'), request.loadedUrl);
                link = removeUrlPageParam(link);
                if (link === undefined) return;

                const newSiteData: SiteData = {
                    department: siteData.department,
                    isPinned: false,
                    isList: false,
                    dateString: '',
                };
                this.log.info('Enqueueing', { link });
                requestQueue.addRequest({
                    url: link,
                    userData: newSiteData,
                });
            });
            if (request.loadedUrl === undefined) throw new TypeError('request.loadedUrl is undefined');
            const urlInstance = new URL(request.loadedUrl);
            const page = +(urlInstance.searchParams.get('page') ?? 1);
            const lastNoticeId = +$('table tbody tr').last().find('td').first().text().trim();

            if (lastNoticeId > 1) {
                const nextUrlInstance = new URL(urlInstance.href);
                nextUrlInstance.searchParams.set('page', (page + 1).toString());
                const nextList = nextUrlInstance.href;

                this.log.info('Enqueueing list', { nextList });
                const nextListSiteData: SiteData = {
                    department: siteData.department,
                    isPinned: false,
                    isList: true,
                    dateString: '',
                    commonUrl: siteData.commonUrl,
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
}

export const math = new MathCrawler({
    departmentName: '수리과학부',
    departmentCode: 'math', // this value must be equal to the filename
    departmentCollege: SCIENCE,
    baseUrl: 'http://www.math.snu.ac.kr/board/index.php?mid=notice',
});
