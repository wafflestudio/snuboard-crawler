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
import { UNION } from '../../constants';

class IscCrawler extends Crawler {
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

            notice.department = siteData.department;
            notice.departmentCode = departmentCode(siteData.department.name);
            notice.title = $('h2').text().trim();

            const contentElement = $('div.post_content');
            contentElement.find('h2').remove();
            const content = load(contentElement.html() ?? '', { decodeEntities: false })('body').html() ?? '';
            // ^ encode non-unicode letters with utf-8 instead of HTML encoding
            notice.content = content;
            notice.contentText = contentElement.text().trim(); // texts are automatically utf-8 encoded

            const dateString: string = $('span.time').text();
            notice.createdAt = strptime(dateString, '%B %d, %Y');

            notice.isPinned = siteData.isPinned;

            notice.link = url;

            await saveNotice(notice);

            const tags = ['공지사항'];

            await getOrCreateTagsWithMessage(tags, notice, siteData.department);
        } else {
            throw new TypeError('Selector is undefined');
        }
    };

    handleList = async (context: CheerioHandlePageInputs, requestQueue: RequestQueue): Promise<void> => {
        const { request, $ } = context;
        const { url } = request;
        const siteData = <SiteData>request.userData;
        const page = +url.replace(/[^0-9]/g, '');
        this.log.info('Page opened.', { url });
        if ($ !== undefined) {
            $('a.qode-blog-centered-button').each((index, element) => {
                // const title = titleElement.text();
                const link = absoluteLink($(element).attr('href'), request.loadedUrl)?.replace('/en/', '/');
                if (link === undefined) return;
                // const viewCount = +$($(element).children('td')[2]).text().trim() ?? 0;

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

            const nextPage = +(
                $('div.pagination ul li.next a')
                    .attr('href')
                    ?.replace(/[^0-9]/g, '') ?? ''
            );

            if (nextPage === page) return;

            const nextListSplit = url.split('/');
            nextListSplit[nextListSplit.length - 2] = `${page + 1}`;
            const nextList = nextListSplit.join('/');
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

export const isc = new IscCrawler({
    departmentName: '정보문화학',
    departmentCode: 'isc', // this value must be equal to the filename
    departmentCollege: UNION,
    baseUrl: 'http://isc.snu.ac.kr/notice/page/1/',
});
