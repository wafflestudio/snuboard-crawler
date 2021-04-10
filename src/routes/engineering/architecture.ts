// filename must equal to first level of url domain.
// e.g. architecture.snu.ac.kr -> architecture.ts

import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { RequestQueue } from 'apify';
import { load } from 'cheerio';
import { URL } from 'url';
import { File, Notice } from '../../../server/src/notice/notice.entity.js';
import { SiteData } from '../../types/custom-types';
import { absoluteLink, getOrCreate, getOrCreateTags, saveNotice } from '../../utils';
import { strptime } from '../../micro-strptime';
import { ENGINEERING } from '../../constants';
import { Crawler } from '../../classes/crawler';

class ArchitectureCrawler extends Crawler {
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
            const title = $('div.body_title div.kr p').text().trim();
            notice.title = title;
            const contentElement = $('div.body_text.kr_body.lev3body');

            const content = load(contentElement.html() ?? '', { decodeEntities: false })('body').html() ?? '';
            // ^ encode non-unicode letters with utf-8 instead of HTML encoding
            notice.content = content;
            notice.contentText = contentElement.text().trim(); // texts are automatically utf-8 encoded

            notice.createdAt = strptime(siteData.dateString, '%Y.%m.%d');
            notice.isPinned = siteData.isPinned;
            notice.link = url;

            await saveNotice(notice);

            const files: File[] = [];
            $('div.body_text.kr_body.attachment_files a').each((index, element) => {
                const fileUrl = $(element).attr('href');
                if (fileUrl) {
                    const file = new File();
                    file.name = $(element).text().trim();
                    file.link = fileUrl.endsWith('.pdf') ? fileUrl : request.loadedUrl;
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

            const tags = ['공지사항'];
            await getOrCreateTags(tags, notice, siteData.department);
        }
    };

    handleList = async (context: CheerioHandlePageInputs, requestQueue: RequestQueue): Promise<void> => {
        const { request, $ } = context;
        const { url } = request;
        const siteData = <SiteData>request.userData;
        this.log.info('Page opened.', { url });
        const urlInstance = new URL(url, this.baseUrl);
        const page = +(urlInstance.pathname.split('/')[4] ?? 1);

        if ($) {
            $('div.listbox_pinup, div.listbox').each((index, element) => {
                const isPinned = $(element).attr('class') === 'listbox_pinup';
                if (page > 1 && isPinned) return;
                const titleElement = $(element).find('div.kr a');
                // const title = titleElement.children('strong').first().text();
                const link = absoluteLink(titleElement.attr('href'), request.loadedUrl);
                if (link === undefined) return;
                const preParseString = $(element).find('div.listbox_date.lev3.kr').text();
                const dateString = preParseString.substring(preParseString.search(/\d{4}.\d{2}.\d{2}/)).trim();
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

            const nextPageElem = $('div.navigator div.wp-pagenavi a.page.larger');

            if (nextPageElem.length) {
                const nextPath = urlInstance.pathname.split('/').slice(0, 3).join('/');

                const nextList = absoluteLink(`${nextPath}/page/${page + 1}`, request.loadedUrl);
                if (!nextList) return;
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
        }
    };
}

export const architecture = new ArchitectureCrawler({
    departmentName: '건축학과',
    departmentCode: 'architecture',
    baseUrl: 'https://architecture.snu.ac.kr/activities/notice/',
    departmentCollege: ENGINEERING,
});
