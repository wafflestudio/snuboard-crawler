// filename must equal to first level of url domain.
// e.g. geog.snu.ac.kr -> geog.ts

import { RequestQueue } from 'apify';
import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { load } from 'cheerio';
import { URL } from 'url';
import { File, Notice } from '../../../server/src/notice/notice.entity.js';
import { SiteData } from '../../types/custom-types';
import { absoluteLink, getOrCreate, getOrCreateTagsWithMessage, parseTitle, saveNotice } from '../../utils';
import { strptime } from '../../micro-strptime';
import { CategoryCrawler } from '../../classes/categoryCrawler.js';
import { SOCIAL } from '../../constants';

export class GeogCrawler extends CategoryCrawler {
    handlePage = async (context: CheerioHandlePageInputs): Promise<void> => {
        const { request, $ } = context;
        const { url } = request;
        const siteData = <SiteData>request.userData;
        const boardCategory: string = url.split('/')[4];

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

            // find category in stat.snu.ac.kr & geog.snu.ac.kr
            notice.title = $('div.board_view_header strong.tit').text().trim();

            const contentElement = $('div.board_view_content');
            const content = load(contentElement.html() ?? '', { decodeEntities: false })('body').html() ?? '';
            // ^ encode non-unicode letters with utf-8 instead of HTML encoding
            notice.content = content;
            notice.contentText = contentElement.text().trim(); // texts are automatically utf-8 encoded
            notice.createdAt = strptime(siteData.dateString, '%Y-%m-%d');
            notice.isPinned = siteData.isPinned;
            notice.link = url;
            await saveNotice(notice);

            const files: File[] = [];
            $('div.board_view_attach a').each((index, element) => {
                // const fileUrlRe = /download_file\('SINGLE', '(.*)\)/;
                // const fileUrl = $(element).attr('onclick')?.match(fileUrlRe);
                const file = new File();
                // eslint-disable-next-line prefer-destructuring
                file.name = $(element).text().trim();
                file.link = url;
                files.push(file);
            });

            await Promise.all(
                // using Promise.all in order to ensure full execution
                files.map(async (file) => {
                    file.notice = notice;
                    await getOrCreate(File, file);
                }),
            );

            let tags: string[] = [];

            // find category in geog.snu.ac.kr and communication.snu.ac.kr
            const category = $('em.cate').text().trim();
            if (category.length > 0) {
                tags.push(category);
            }

            // geog의 장학 게시판, stat의 취업정보 게시
            if (['장학', '취업정보'].includes(this.categoryTags[boardCategory])) {
                tags = [];
            }
            tags.push(this.categoryTags[boardCategory]);

            tags = tags.filter((tag) => tag !== this.excludedTag);
            await getOrCreateTagsWithMessage(tags, notice, siteData.department, this.excludedTags);
        }
    };

    handleList = async (context: CheerioHandlePageInputs, requestQueue: RequestQueue): Promise<void> => {
        const { request, $ } = context;
        const { url } = request;
        const siteData = <SiteData>request.userData;
        this.log.info('Page opened.', { url });

        if ($) {
            const urlInstance = new URL(url);
            const page: number = +(urlInstance.searchParams.get('var_page') ?? 1);

            $('div.board_type_list ul.body li div')
                .not('.subject')
                .each((index, element) => {
                    const isPinned = $(element).find('span.no').text().trim() === '공지';

                    const titleElement = $(element).find('div.subject a');
                    const titleRe = /go_board_view\('(.*)'\)/;
                    const noticeNum = titleElement.attr('onclick')?.match(titleRe)?.[1];

                    if (noticeNum === undefined) return;
                    const nextUrl = new URL(request.loadedUrl);
                    if (nextUrl === undefined) return;
                    nextUrl.searchParams.set('board_mode', 'VIEW');
                    nextUrl.searchParams.delete('var_page');
                    nextUrl.searchParams.set('search_field', 'ALL');
                    nextUrl.searchParams.set('search_task', 'ALL');
                    nextUrl.searchParams.set('bid', noticeNum);
                    const dateString = $(element).find('span.date').text().trim();
                    const link = nextUrl.href;
                    const newSiteData: SiteData = {
                        department: siteData.department,
                        isPinned,
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

            const nextPage = +(
                new URL(
                    absoluteLink($('div.paging a.next').attr('href'), request.loadedUrl) ?? this.baseUrl,
                ).searchParams.get('var_page') ?? 1
            );

            if (page !== nextPage) {
                urlInstance.searchParams.set('var_page', (page + 1).toString());

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

export const geog = new GeogCrawler({
    departmentName: '지리학과',
    departmentCode: 'geog',
    departmentCollege: SOCIAL,
    baseUrl: 'https://geog.snu.ac.kr/category/',
    categoryTags: {
        board_6_GN_2Z1g8Vlm_20201130090533: '공지사항',
        board_6_GN_DE0jOHLs_20201130090606: '장학',
        board_6_GN_UuL4J4P2_20201130090631: '소식/행사',
    },
});
