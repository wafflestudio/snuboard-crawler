// filename must equal to first level of url domain.
// e.g. ie.snu.ac.kr -> ie.ts

import { URL } from 'url';

import { RequestQueue } from 'apify';
import { load } from 'cheerio';
import { CheerioCrawlingContext } from 'crawlee';

import { File, Notice } from '../../../server/src/notice/notice.entity.js';
import { CategoryCrawler } from '../../classes/categoryCrawler.js';
import { ENGINEERING } from '../../constants.js';
import { strptime } from '../../micro-strptime.js';
import { SiteData } from '../../types/custom-types';
import { absoluteLink, departmentCode, getOrCreate, getOrCreateTagsWithMessage, saveNotice } from '../../utils.js';

class IECrawler extends CategoryCrawler {
    override handlePage = async (context: CheerioCrawlingContext<SiteData, any>): Promise<void> => {
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
                $(element).attr('src', absoluteLink(imgSrc, this.baseUrl) ?? '');
            });
            const notice = await getOrCreate(Notice, { link: url }, false);

            notice.department = siteData.department;
            notice.departmentCode = departmentCode(siteData.department.name);
            const title = $('div[property="dc:title"]').children('h2').text();
            notice.title = title;
            const contentElement = $('div[property="content:encoded"]');

            const content =
                load(contentElement.html() ?? '', {
                    // @ts-ignore

                    decodeEntities: false,
                })('body').html() ?? '';
            // ^ encode non-unicode letters with utf-8 instead of HTML encoding
            notice.content = content;
            notice.contentText = contentElement.text().trim(); // texts are automatically utf-8 encoded
            const fullDateString: string = $('div.field-name-post-date').find('div.field-item').text().trim();

            try {
                notice.createdAt = strptime(fullDateString, '%Y-%m-%d %H:%M:%S');
            } catch {
                notice.createdAt = strptime(siteData.dateString, '%Y-%m-%d');
            }

            notice.isPinned = siteData.isPinned;
            notice.link = url;

            await saveNotice(notice);

            const files: File[] = [];
            $('div.field-name-field-attachment')
                .find('span.file')
                .each((index, element) => {
                    const fileUrl = $(element).children('a').attr('href');
                    if (fileUrl) {
                        const file = new File();
                        file.name = $(element).children('a').text().trim();
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

            const category = new URL(url).pathname.split('/')[3]; // url.replace(BaseUrl, '').split('?')[0];
            const tags = [this.categoryTags[category]];
            await getOrCreateTagsWithMessage(tags, notice, siteData.department);
        } else {
            throw new TypeError('Selector is undefined');
        }
    };

    override handleList = async (
        context: CheerioCrawlingContext<SiteData, any>,
        requestQueue: RequestQueue,
    ): Promise<void> => {
        const { request, $ } = context;
        const { url } = request;
        const siteData = <SiteData>request.userData;
        this.log.info('Page opened.', { url });

        if ($ !== undefined) {
            $('tbody tr').each((index, element) => {
                const titleElement = $(element).children('td.views-field-title-field').children('a');
                if (request.loadedUrl === undefined) throw new TypeError('request.loadedUrl is undefined');
                const link = absoluteLink(titleElement.attr('href'), request.loadedUrl);
                if (link === undefined) return;
                const dateString = $(element).find('td.views-field-created').text().trim();

                const newSiteData: SiteData = {
                    department: siteData.department,
                    isPinned: false,
                    isList: false,
                    dateString,
                    commonUrl: siteData.commonUrl,
                };
                this.log.info('Enqueueing', { link });
                requestQueue.addRequest({
                    url: link,
                    userData: newSiteData,
                });
            });

            const endElement = $('ul.pagination').children('li.pager-last').children('a').attr('href');
            if (request.loadedUrl === undefined) throw new TypeError('request.loadedUrl is undefined');
            const endUrl = absoluteLink(endElement, request.loadedUrl);
            if (!endUrl) return;
            const endUrlInstance = new URL(endUrl);
            const urlInstance = new URL(url);
            const page: number = +(urlInstance.searchParams.get('page') ?? 1);
            const endPage = endUrlInstance.searchParams.get('page');

            if (endPage && page < +endPage) {
                urlInstance.searchParams.set('page', (page + 1).toString());

                const nextList: string = urlInstance.href;
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

export const ie = new IECrawler({
    departmentName: '산업공학과',
    departmentCode: 'ie',
    baseUrl: 'http://ie.snu.ac.kr/ko/board/',
    departmentCollege: ENGINEERING,
    categoryTags: {
        2: '학과 주요뉴스',
        3: '학과 행사',
        4: '자료실',
        5: '기타사항',
        6: '취업',
        7: '학부',
        8: '대학원',
        //  14:'역대 이중한 상 수상자',
        15: '장학금',
    },
});
