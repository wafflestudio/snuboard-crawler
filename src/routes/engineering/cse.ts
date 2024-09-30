// filename must equal to first level of url domain.
// e.g. cse.snu.ac.kr -> cse.ts

import { RequestQueue } from 'apify';
import { load } from 'cheerio';
import { CheerioCrawlingContext } from 'crawlee';

import { File, Notice } from '../../../server/src/notice/notice.entity.js';
import { Crawler } from '../../classes/crawler.js';
import { ENGINEERING } from '../../constants.js';
import { strptime } from '../../micro-strptime.js';
import { SiteData } from '../../types/custom-types';
import { absoluteLink, departmentCode, getOrCreate, getOrCreateTagsWithMessage, saveNotice } from '../../utils.js';

class CSECrawler extends Crawler {
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
            notice.title = $('h2').text().trim();

            let contentElement;
            let content;

            contentElement = $('div.sun-editor-editable');
            if (contentElement.children('div').last().text() == '')
                contentElement.children('div').last().remove()
            content = contentElement.html() ?? '';

            content =
                load(content, {
                    // @ts-ignore
                    decodeEntities: false,
                })('body').html() ?? '';
            // ^ encode non-unicode letters with utf-8 instead of HTML encoding
            notice.content = content;
            notice.contentText = contentElement.text().trim(); // texts are automatically utf-8 encoded

            try {
                // example: '2021/02/15 (월) 오후 7:21'
                const fullDateString: string = $('div.gap-5 p:nth-child(2)').text().split('작성 날짜: ')[1].trim();
                notice.createdAt = strptime(fullDateString, '%Y/%m/%d %a %p %H:%M');
            } catch (error) {
                if (error instanceof TypeError) {
                    notice.createdAt = strptime(siteData.dateString, '%Y/%m/%d');
                } else {
                    throw error;
                }
            }

            notice.isPinned = siteData.isPinned;

            notice.link = url;

            // author: $('span.username').text().trim()

            await saveNotice(notice);

            const files: File[] = [];
            $('div.self-start').each(function (index, element) {
                const fileUrl = $(element).attr('href');
                if (fileUrl) {
                    const file = new File();
                    file.name = $(element).text().trim();
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


            const tags: string[] = [];

            $('div.ml-6 a').each((index, element) => {
                const tagString = $(element).text().trim();
                tags.push(tagString);
            });

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
            $('ul li').each((index, element) => {
                const isPinned = $($(element).children()[0]).children().length > 0;
                const titleElement = $($($(element).children()[1]).children()[0]);
                // const title = titleElement.text();
                if (request.loadedUrl === undefined) throw new TypeError('request.loadedUrl is undefined');
                const link = absoluteLink(titleElement.attr('href'), request.loadedUrl.replace('/ko/', '/').replace('/en/', '/'))?.split('?', 1)[0];
                if (link === undefined) return;
                const dateString = $($(element).children()[2]).text().trim();
                // const viewCount = +$($(element).children('td')[2]).text().trim() ?? 0;

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
            if (request.loadedUrl === undefined) throw new TypeError('request.loadedUrl is undefined');

            const urlInstance = new URL(request.loadedUrl);
            urlInstance.searchParams.set('pageNum', String(1 + Number(urlInstance.searchParams.get('pageNum') ?? '1')));
            const nextList = urlInstance.toString();
            if (nextList === undefined) return;
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
        } else {
            throw new TypeError('Selector is undefined');
        }
    };
}

export const cse = new CSECrawler({
    departmentName: '컴퓨터공학부',
    departmentCode: 'cse', // this value must be equal to the filename
    departmentCollege: ENGINEERING,
    baseUrl: 'https://cse.snu.ac.kr/community/notice',
});
