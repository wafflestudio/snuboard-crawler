// filename must equal to first level of url domain.
// e.g. ir.snu.ac.kr -> ir.ts

import { RequestQueue } from 'apify';
import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { load } from 'cheerio';
import { URL } from 'url';
import { File, Notice } from '../../../server/src/notice/notice.entity.js';
import { SiteData } from '../../types/custom-types';
import { absoluteLink, departmentCode, getOrCreate, getOrCreateTagsWithMessage, saveNotice } from '../../utils';
import { strptime } from '../../micro-strptime';
import { CategoryCrawler } from '../../classes/categoryCrawler.js';
import { SOCIAL } from '../../constants';

class SociologyCrawler extends CategoryCrawler {
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
            notice.departmentCode = departmentCode(siteData.department.name);

            notice.title = $('div.col-sm-8').text().trim();
            const contentElement = $('div.content');
            const content = load(contentElement.html() ?? '', { decodeEntities: false })('body').html() ?? '';
            // ^ encode non-unicode letters with utf-8 instead of HTML encoding
            notice.content = content;
            notice.contentText = contentElement.text().trim(); // texts are automatically utf-8 encoded
            notice.createdAt = strptime(siteData.dateString, '%Y-%m-%d %H:%M');
            notice.isPinned = siteData.isPinned;
            notice.link = url;

            await saveNotice(notice);
            const tags: string[] = [this.categoryTags[siteData.tag ?? '']] ?? ['공지사항'];
            await getOrCreateTagsWithMessage(tags, notice, siteData.department);
        }
    };

    handleList = async (context: CheerioHandlePageInputs, requestQueue: RequestQueue): Promise<void> => {
        const { request, $ } = context;
        const { url } = request;
        const siteData = <SiteData>request.userData;
        const urlSplit = url.split('/');
        this.log.info('Page opened.', { url });

        if ($) {
            const page = +(urlSplit.pop() ?? '');

            $('table.list tbody tr').each((index, element) => {
                const titleElement = $(element).find('td a');

                let link = absoluteLink(titleElement.attr('href'), request.loadedUrl);
                if (link === undefined) return;
                const pageUrl = new URL(link);
                pageUrl.searchParams.delete('fromPage');
                link = pageUrl.href;

                const dateString = $(element).children('td:nth-child(3)').text().trim();
                const newSiteData: SiteData = {
                    department: siteData.department,
                    isPinned: false,
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

            const isLast = $('ul.pagination li').last().text() !== '»';

            if (!isLast) {
                urlSplit.push(`${page + 1}`);
                const nextList = urlSplit.join('/');

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
        }
    };
}

export const sociology = new SociologyCrawler({
    departmentName: '사회학과',
    departmentCode: 'sociology',
    departmentCollege: SOCIAL,
    baseUrl: 'http://sociology.snu.ac.kr/board/list/',
    categoryTags: {
        'undergraduate/1': '학부',
        'graduate/1': '대학',
        'news/1': '학과소식',
        'recruit/1': '채용/홍보',
    },
});
