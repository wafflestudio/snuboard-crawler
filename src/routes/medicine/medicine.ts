// filename must equal to first level of url domain.

import { RequestQueue } from 'apify';
import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { load } from 'cheerio';
import { URL } from 'url';
import * as Url from 'url';
import { File, Notice } from '../../../server/src/notice/notice.entity.js';
import { ChemPageSummary, MedPageSummary, SiteData } from '../../types/custom-types';
import { absoluteLink, getOrCreate, getOrCreateTags, parseTitle, removeUrlPageParam, saveNotice } from '../../utils';
import { strptime } from '../../micro-strptime';
import { Crawler } from '../../classes/crawler';
import { MEDICINE } from '../../constants';

export class MedicineCrawler extends Crawler {
    noticeBaseUrl = 'https://medicine.snu.ac.kr/fnt/nac/selectNoticeDetail.do';

    nextListBaseUrl = 'https://medicine.snu.ac.kr/fnt/nac/selectNoticeListAjax.do';

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

            // find category in stat.snu.ac.kr & geog.snu.ac.kr
            const tagTitle = parseTitle($('div.board_view_header strong.tit').text().trim());
            notice.title = tagTitle.title;

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

            const tags: string[] = [];
            tagTitle.tags = tagTitle.tags.flatMap((tag) => tag.split('/')).map((tag) => tag.trim());
            tagTitle.tags.forEach((tag) => {
                tags.push(tag);
            });

            // find category in geog.snu.ac.kr
            const category = $('em.cate').text().trim();
            if (category.length > 0) {
                tags.push(category);
            }

            await getOrCreateTags(tags, notice, siteData.department);
        }
    };

    handleFirst = async (context: CheerioHandlePageInputs, requestQueue: RequestQueue) => {
        const { request, $ } = context;
        const siteData = <SiteData>request.userData;
        if ($) {
            $('div.board_wrap ul.board_list li')
                .not('.thead')
                .each((index, element) => {
                    const isPinned = $(element).find('b.btn_notice').text().trim() === '공지';

                    const titleElement = $(element).find('a');
                    const titleRe = /goToDetail\('(.*)'\)/;
                    const noticeNum = titleElement.attr('onclick')?.match(titleRe)?.[1];

                    if (noticeNum === undefined) return;
                    const nextUrl = new URL(this.noticeBaseUrl);
                    nextUrl.searchParams.set('bbsId', 'BBSMSTR_000000000001');
                    nextUrl.searchParams.set('nttId', noticeNum);
                    const dateString = $(element).find('span.date').text().trim();
                    const link = nextUrl.href;
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
            const nextUrl = new URL(this.nextListBaseUrl);
            nextUrl.searchParams.set('bbsId', 'BBSMSTR_000000000001');
            nextUrl.searchParams.set('pageIndex', '2');
            nextUrl.searchParams.set('recordCountPerPage', '10');
            nextUrl.searchParams.set('more', 'Y');
            const nextList: string = nextUrl.href;
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
    };

    handleMore = async (context: CheerioHandlePageInputs, requestQueue: RequestQueue) => {
        const { request, $, body } = context;
        const { url } = request;
        const siteData = <SiteData>request.userData;
        let listData;
        if (typeof body === 'string') {
            listData = JSON.parse(body).list;
        } else return;
        const nextUrl = new URL(this.noticeBaseUrl);
        if (listData !== undefined) {
            listData.forEach((element: MedPageSummary) => {
                if (Number.isNaN(+element.rn)) return;
                nextUrl.searchParams.set('bbsId', 'BBSMSTR_000000000001');
                nextUrl.searchParams.set('nttId', element.nttId);
                const link = nextUrl.href;
                if (link === undefined) return;
                const dateString = `20${element.frstRegistPnttm}`;

                const newSiteData: SiteData = {
                    department: siteData.department,
                    isPinned: false,
                    isList: false,
                    dateString,
                };
                this.log.info('Enqueueing', { link });
                requestQueue.addRequest({
                    url: link,
                    userData: newSiteData,
                });
            });

            const page: number = listData[0].pageIndex;

            if (listData.length > 0) {
                const nextListUrlInstance = new URL(this.nextListBaseUrl);
                nextListUrlInstance.searchParams.set('pageIndex', (page + 1).toString());
                nextUrl.searchParams.set('bbsId', 'BBSMSTR_000000000001');
                nextUrl.searchParams.set('recordCountPerPage', '10');
                nextUrl.searchParams.set('more', 'Y');

                const nextList: string = nextListUrlInstance.href;
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
            throw new TypeError('listData is undefined');
        }
    };

    handleList = async (context: CheerioHandlePageInputs, requestQueue: RequestQueue): Promise<void> => {
        const { request } = context;
        const { url } = request;
        this.log.info('Page opened.', { url });
        if (url === this.baseUrl) {
            this.handleFirst(context, requestQueue);
        } else {
            this.handleMore(context, requestQueue);
        }
    };
}

export const medicine = new MedicineCrawler({
    departmentName: '의과대학',
    departmentCode: 'medicine',
    departmentCollege: MEDICINE,
    // departmentUrl: "https://medicine.snu.ac.kr/",
    baseUrl: 'https://medicine.snu.ac.kr/fnt/nac/selectNoticeList.do?bbsId=BBSMSTR_000000000001',
});
