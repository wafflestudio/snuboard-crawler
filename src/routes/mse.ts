// filename must equal to first level of url domain.
// e.g. mse.snu.ac.kr -> mse.ts

import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { RequestQueue } from 'apify';
import { load } from 'cheerio';
import { URL } from 'url';
import { Notice, File } from '../../server/src/notice/notice.entity.js';
import { SiteData } from '../types/custom-types';
import { absoluteLink, getOrCreate, getOrCreateTags, saveNotice } from '../utils';
import { strptime } from '../micro-strptime';
import { CategoryCrawler } from '../classes/categoryCrawler.js';
import { ENGINEERING } from '../constants';

class MSECrawler extends CategoryCrawler {
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
            const title = $('td[id="fn"]').text();
            notice.title = title;
            const contentElement = $('td[class="s_default_view_body_2"]').find('td');
            contentElement.find('div[class="mnSns"]').remove();
            const content = load(contentElement.html() ?? '', { decodeEntities: false })('body').html() ?? '';
            // ^ encode non-unicode letters with utf-8 instead of HTML encoding
            notice.content = content;
            notice.preview = contentElement.text().substring(0, 1000).trim(); // texts are automatically utf-8 encoded
            notice.createdAt = strptime(siteData.dateString, '%Y-%m-%d');

            notice.isPinned = siteData.isPinned;
            notice.link = url;

            await saveNotice(notice);

            const files: File[] = [];
            $('#boardSkin_s_default_view > tbody > tr:nth-child(1) > td a').each((index, element) => {
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

            const category = new URL(url).searchParams.get('category') ?? '64';
            const tags: string[] = [];
            if (siteData.tag) {
                tags.push(siteData.tag);
            }
            if (!tags.includes(this.categoryTags[category])) {
                tags.push(this.categoryTags[category]);
            }
            await getOrCreateTags(tags, notice, siteData.department);
        }
    };

    handleList = async (context: CheerioHandlePageInputs, requestQueue: RequestQueue): Promise<void> => {
        const { request, $ } = context;
        const { url } = request;
        const siteData = <SiteData>request.userData;
        this.log.info('Page opened.', { url });

        if ($) {
            $('tbody tr').each((index, element) => {
                const titleElement = $(element).find('td:nth-child(2) a');
                const noticeIdxRe = /viewData\('([0-9]+)'\)/;
                const noticeIdx = titleElement.attr('onclick')?.match(noticeIdxRe);
                if (!noticeIdx) return;
                const nextUrl = new URL(url);
                nextUrl.searchParams.set('mode', 'view');
                nextUrl.searchParams.set('board_num', noticeIdx[1]);
                nextUrl.searchParams.delete('page');
                const link = nextUrl.href;
                const tag = $(element).find('td:nth-child(1)').text();
                if (link === undefined) return;
                const dateString = $(element).children('td').slice(3, 4).text().trim();
                const newSiteData: SiteData = {
                    department: siteData.department,
                    isPinned: false,
                    isList: false,
                    dateString,
                    tag,
                };
                this.log.info('Enqueueing', { link });
                requestQueue.addRequest({
                    url: link,
                    userData: newSiteData,
                });
            });

            const endElement = $('tfoot tr td a').last().attr('href');
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
                };
                await this.addVaryingRequest(requestQueue, {
                    url: nextList,
                    userData: nextListSiteData,
                });
            }
        }
    };
}

export const mse = new MSECrawler({
    departmentName: '재료공학부',
    departmentCode: 'mse',
    baseUrl: 'https://mse.snu.ac.kr/sub.php?code=notice&category=',
    departmentCollege: ENGINEERING,
    categoryTags: {
        1: '학부',
        2: '대학원',
        64: '전체',
    },
});
