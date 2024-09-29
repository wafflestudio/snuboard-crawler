// filename must equal to first level of url domain.
// e.g. mse.snu.ac.kr -> mse.ts

import { URL } from 'url';

import { RequestQueue } from 'apify';
import { load } from 'cheerio';
import { CheerioCrawlingContext } from 'crawlee';

import { Notice, File } from '../../../server/src/notice/notice.entity.js';
import { CategoryCrawler } from '../../classes/categoryCrawler.js';
import { HUMANITIES } from '../../constants.js';
import { strptime } from '../../micro-strptime.js';
import { SiteData } from '../../types/custom-types';
import { absoluteLink, departmentCode, getOrCreate, getOrCreateTagsWithMessage, saveNotice } from '../../utils.js';

class LinguistCrawler extends CategoryCrawler {
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
            const title = $('table.board tbody tr.thead td div#tdtitle').text();
            let titleText = title;
            const tags: string[] = [];
            if (title.startsWith('[')) {
                titleText = title.slice(title.indexOf(']') + 1).trim();
            }
            notice.title = titleText;
            const fileElement = $('div.attached');
            const contentElement = $('div#mh-board ');
            contentElement.find('table').remove();

            const content =
                load(contentElement.html() ?? '', {
                    // @ts-ignore
                    _useHtmlParser2: true,
                    decodeEntities: false,
                })('body').html() ?? '';
            // ^ encode non-unicode letters with utf-8 instead of HTML encoding
            notice.content = content;
            notice.contentText = contentElement.text().trim(); // texts are automatically utf-8 encoded

            notice.createdAt = strptime(siteData.dateString, '%Y/%m/%d');
            notice.isPinned = siteData.isPinned;
            notice.link = url;

            await saveNotice(notice);

            const files: File[] = [];
            fileElement.each((index, element) => {
                const fileInstance = $(element).children('a').first();
                const fileUrl = fileInstance.attr('href');
                if (fileUrl) {
                    const file = new File();
                    file.name = fileInstance.text().trim();
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

            if (siteData.tag !== undefined) tags.push(siteData.tag);
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
        const urlInstance = new URL(url, this.baseUrl);
        const category = urlInstance.searchParams.get('cat');
        this.log.info('Page opened.', { url });

        if ($ !== undefined) {
            $('div.threadlist').each((index, element) => {
                const titleElement = $(element).find('article header h1 a');
                if (request.loadedUrl === undefined) throw new TypeError('request.loadedUrl is undefined');
                let link = absoluteLink(titleElement.attr('href'), request.loadedUrl);
                if (link === undefined) return;
                const pageUrl = new URL(link);
                pageUrl.searchParams.delete('paged');
                link = pageUrl.href;
                const dateString = $(element).find('article header h1 div.threaddate').text().trim();

                const newSiteData: SiteData = {
                    department: siteData.department,
                    isPinned: false,
                    isList: false,
                    dateString,
                    commonUrl: siteData.commonUrl,
                    tag: this.categoryTags[category ?? ''],
                };
                this.log.info('Enqueueing', { link });
                requestQueue.addRequest({
                    url: link,
                    userData: newSiteData,
                });
            });

            const nextElement = $('div.pagenation a.next');
            if (nextElement.length === 0) return;
            if (request.loadedUrl === undefined) throw new TypeError('request.loadedUrl is undefined');
            const nextList = absoluteLink(nextElement.attr('href'), request.loadedUrl);
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

export const linguist = new LinguistCrawler({
    departmentName: '언어학과',
    departmentCode: 'linguist',
    baseUrl: 'http://hosting01.snu.ac.kr/~linguist/?paged=1&cat=',
    departmentCollege: HUMANITIES,
    categoryTags: {
        6: '학부',
        4: '대학원',
        14: '학술행사',
    },
});
