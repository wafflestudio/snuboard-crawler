// filename must equal to first level of url domain.
// e.g. cse.snu.ac.kr -> cse.ts

import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { RequestQueue } from 'apify';
import { load } from 'cheerio';
import { File, Notice } from '../../../server/src/notice/notice.entity.js';
import { SiteData } from '../../types/custom-types';
import { absoluteLink, departmentCode, getOrCreate, getOrCreateTagsWithMessage, saveNotice } from '../../utils';
import { strptime } from '../../micro-strptime';
import { Crawler } from '../../classes/crawler';
import { ENGINEERING } from '../../constants';

class CSECrawler extends Crawler {
    handlePage = async (context: CheerioHandlePageInputs): Promise<void> => {
        const { request, $ } = context;
        const { url } = request;
        const siteData = <SiteData>request.userData;

        this.log.info('Page opened.', { url });
        if ($ !== undefined) {
            // creation order
            // dept -> notice -> file
            //                -> tag -> notice_tag
            const menu = $('.menu-block-wrapper li a.active').attr('href');
            const isSeminar = menu === '/seminars';

            const notice = await getOrCreate(Notice, { link: url }, false);

            notice.department = siteData.department;
            notice.departmentCode = departmentCode(siteData.department.name);
            notice.title = $('h1#page-title').text().trim();

            let contentElement;
            let content;
            if (isSeminar) {
                contentElement = $('div.node-seminar');
                content = contentElement.html() ?? '';
            } else {
                contentElement = $('div.field-name-body');
                content = contentElement.children('div').children('div').html() ?? '';
            }
            content = load(content, { decodeEntities: false })('body').html() ?? '';
            // ^ encode non-unicode letters with utf-8 instead of HTML encoding
            notice.content = content;
            notice.contentText = contentElement.text().trim(); // texts are automatically utf-8 encoded

            try {
                // example: '2021/02/15 (월) 오후 7:21'
                const fullDateString: string = $('div.submitted').text().split(',')[1].substring(8).trim();
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
            $('span.file').each(function (index, element) {
                const fileUrl = $(element).children('a').attr('href');
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

            if (isSeminar) {
                const tags = ['세미나'];
                await getOrCreateTagsWithMessage(tags, notice, siteData.department);
            } else {
                const tags: string[] = [];

                $('div.field-name-field-tag').each((index, element) => {
                    const tagString = $(element).text();

                    if (tagString.includes('태그:')) {
                        tagString
                            .replace('태그:', '')
                            .split(',')
                            .map((tag) => tag.trim())
                            .filter((value) => value.length > 0)
                            .forEach((tag) => tags.push(tag));
                    } else {
                        throw new TypeError(`tagString ${tagString} does not include '태그:'`);
                    }
                });

                await getOrCreateTagsWithMessage(tags, notice, siteData.department);
            }
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
            $('table.views-table tbody tr').each((index, element) => {
                const isPinned = $(element).attr('class')?.split(' ').includes('sticky') ?? false;
                const titleElement = $($($(element).children('td')[0]).children('a'));
                // const title = titleElement.text();
                const link = absoluteLink(titleElement.attr('href'), request.loadedUrl)?.replace('/en/', '/');
                if (link === undefined) return;
                const dateString = $($(element).children('td')[1]).text().trim();
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

            const nextList = absoluteLink($('li.pager-next').children('a').attr('href'), request.loadedUrl);
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
    baseUrl: 'https://cse.snu.ac.kr/department-notices',
});
