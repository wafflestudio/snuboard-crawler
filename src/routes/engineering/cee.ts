// filename must equal to first level of url domain.
// e.g. cee.snu.ac.kr -> cee.ts

import { RequestQueue } from 'apify';
import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { load } from 'cheerio';
import { URL } from 'url';
import { File, Notice } from '../../../server/src/notice/notice.entity.js';
import { SiteData } from '../../types/custom-types';
import { absoluteLink, getOrCreate, getOrCreateTagsWithMessage, parseTitle, saveNotice } from '../../utils';
import { strptime } from '../../micro-strptime';
import { CategoryCrawler } from '../../classes/categoryCrawler.js';
import { ENGINEERING } from '../../constants';

class CEECrawler extends CategoryCrawler {
    handlePage = async (context: CheerioHandlePageInputs): Promise<void> => {
        const { request, $ } = context;
        const { url } = request;
        const siteData = <SiteData>request.userData;

        this.log.info('Page opened.', { url });
        if ($) {
            // creation order
            // dept -> notice -> file
            //                -> tag -> notice_tag
            $('img').each((index, element) => {
                const imgSrc = $(element).attr('src');
                $(element).attr('src', absoluteLink(imgSrc, this.baseUrl) ?? '');
            });

            const notice = await getOrCreate(Notice, { link: url }, false);

            notice.department = siteData.department;

            const titleText = $('div.bo_view').children('div.bo_view_1').children('div').text().trim();
            const category = new URL(url).searchParams.get('bo_table') ?? ''; // url.replace(BaseUrl, '').split('?')[0];

            const { title, tags } =
                this.categoryTags[category] === '공지사항' ? parseTitle(titleText) : { title: titleText, tags: [] };

            tags.push(this.categoryTags[category]);

            notice.title = title;
            const contentElement = $('div.bo_view').children('div.bo_view_2');

            const content = load(contentElement.html() ?? '', { decodeEntities: false })('body').html() ?? '';
            // ^ encode non-unicode letters with utf-8 instead of HTML encoding
            notice.content = content;
            notice.contentText = contentElement.text().trim(); // texts are automatically utf-8 encoded
            const fullDateString = `20${$('div.bo_view')
                .children('div.bo_view_1')
                .children('table')
                .children('tr')
                .first()
                .find('td')
                .slice(1, 2)
                .text()}`;
            if (!fullDateString) return;

            notice.createdAt = strptime(fullDateString, '%Y-%m-%d %H:%M');
            notice.isPinned = siteData.isPinned;
            notice.link = url;

            await saveNotice(notice);

            const files: File[] = [];
            $('div.bo_view')
                .children('div.bo_view_1')
                .children('table')
                .children('tr')
                .slice(1)
                .each((index, element) => {
                    // const fileUrlRe = /file_download\('(.*)',.*\)/;
                    // const fileUrl = $(element).find('a').attr('href')?.match(fileUrlRe);
                    const fileUrl = $(element).find('a').attr('href');
                    if (fileUrl) {
                        const file = new File();
                        file.name = $(element).find('a').children('span').first().text().trim();
                        // file.link = absoluteLink(fileUrl[1], this.baseUrl) ?? '';
                        file.link = notice.link;
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

            await getOrCreateTagsWithMessage(tags, notice, siteData.department);
        }
    };

    handleList = async (context: CheerioHandlePageInputs, requestQueue: RequestQueue): Promise<void> => {
        const { request, $ } = context;
        const { url } = request;
        const siteData = <SiteData>request.userData;
        this.log.info('Page opened.', { url });

        if ($) {
            const urlInstance = new URL(url);
            const page: number = +(urlInstance.searchParams.get('page') ?? 1);

            $('table.board_list tr')
                .slice(1)
                .each((index, element) => {
                    const isPinned = $(element).children('td.num').text().trim() === '공지';
                    if (page > 1 && isPinned) return;

                    const titleElement = $(element).children('td.subject').children('nobr').children('a');

                    let link = absoluteLink(titleElement.attr('href'), request.loadedUrl);
                    if (link === undefined) return;
                    const pageUrl = new URL(link);
                    pageUrl.searchParams.delete('page');
                    link = pageUrl.href;

                    const dateString = $(element).children('td.datetime').text().trim();
                    const newSiteData: SiteData = {
                        department: siteData.department,
                        isPinned,
                        isList: false,
                        commonUrl: siteData.commonUrl,
                        dateString,
                    };
                    this.log.info('Enqueueing', { link });
                    requestQueue.addRequest({
                        url: link,
                        userData: newSiteData,
                    });
                });

            const endElement = $('div.board_page').find('img[title="맨끝"]').parent().attr('href');
            const endUrl = absoluteLink(endElement, request.loadedUrl);
            if (!endUrl) return;
            const endUrlInstance = new URL(endUrl);
            const endPage = endUrlInstance.searchParams.getAll('page');

            if (endPage && page < +endPage[endPage.length - 1]) {
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
        }
    };
}

export const cee = new CEECrawler({
    departmentName: '건설환경공학부',
    departmentCode: 'cee',
    departmentCollege: ENGINEERING,
    baseUrl: 'https://cee.snu.ac.kr/bbs/board.php?bo_table=',
    categoryTags: {
        sub6_1: '공지사항',
        sub6_2: '장학금',
        sub6_3: '취업정보',
    },
});
