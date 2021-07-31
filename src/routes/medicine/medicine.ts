// filename must equal to first level of url domain.

import { RequestQueue } from 'apify';
import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { load } from 'cheerio';
import { URL } from 'url';
import { File, Notice } from '../../../server/src/notice/notice.entity.js';
import { MedPageSummary, SiteData } from '../../types/custom-types';
import { absoluteLink, getOrCreate, getOrCreateTagsWithMessage, saveNotice } from '../../utils';
import { strptime } from '../../micro-strptime';
import { Crawler } from '../../classes/crawler';
import { MEDICINE } from '../../constants';

export class MedicineCrawler extends Crawler {
    noticeBaseUrl = 'https://medicine.snu.ac.kr/fnt/nac/selectNoticeDetail.do';

    nextListBaseUrl = 'https://medicine.snu.ac.kr/fnt/nac/selectNoticeListAjax.do';

    fileDownloadUrl = 'https://medicine.snu.ac.kr/dsc/cmm/dscIndex/downloadFile.do';

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

            notice.title = $('span.subject span.ellipsis2').text().trim();

            const contentElement = $(' div.view_contents');
            const content = load(contentElement.html() ?? '', { decodeEntities: false })('body').html() ?? '';
            // ^ encode non-unicode letters with utf-8 instead of HTML encoding
            notice.content = content;
            notice.contentText = contentElement.text().trim(); // texts are automatically utf-8 encoded
            notice.createdAt = strptime(siteData.dateString, '%Y.%m.%d');
            notice.isPinned = siteData.isPinned;
            notice.link = url;
            await saveNotice(notice);
            const fileKey = $('#fileKey').attr('value') ?? '';
            const registerId = $('#frstRegisterId').attr('value') ?? '';
            const files: File[] = [];
            $('li.attach_file a.file').each((index, element) => {
                const fileUrlRe = /fnFileDownload\('(.*)'\)/;
                const fileNum = $(element).attr('onclick')?.match(fileUrlRe)?.[1];
                if (fileNum === undefined) {
                    return;
                }
                const fileUrl = new URL(this.fileDownloadUrl);
                fileUrl.searchParams.set('fileKey', fileKey);
                fileUrl.searchParams.set('frstRegisterId', registerId);
                fileUrl.searchParams.set('file_id', fileNum);
                const file = new File();
                // eslint-disable-next-line prefer-destructuring
                file.name = $(element).text().trim();
                file.link = fileUrl.href;
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
            if (siteData.tag) {
                tags.push(siteData.tag);
            }

            await getOrCreateTagsWithMessage(tags, notice, siteData.department);
        }
    };

    handleFirst = async (context: CheerioHandlePageInputs, requestQueue: RequestQueue): Promise<void> => {
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
                    const tag = $(element).find('span.cate').text().trim();
                    if (noticeNum === undefined) return;
                    const nextUrl = new URL(this.noticeBaseUrl);
                    nextUrl.searchParams.set('bbsId', 'BBSMSTR_000000000001');
                    nextUrl.searchParams.set('upper_menu_id', '3000000');
                    nextUrl.searchParams.set('menu_no', '3010000');
                    nextUrl.searchParams.set('nttId', noticeNum);
                    const dateString = $(element).find('span.date').text().trim();
                    const link = nextUrl.href;
                    const newSiteData: SiteData = {
                        department: siteData.department,
                        isPinned,
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

    handleMore = async (context: CheerioHandlePageInputs, requestQueue: RequestQueue): Promise<void> => {
        const { request, body } = context;
        const { url } = request;
        const siteData = <SiteData>request.userData;
        let listData;
        if (typeof body === 'string') {
            const withoutNttCn = body.replace(/"nttCn":"(.*?),(?="nttId")/g, '');
            listData = JSON.parse(withoutNttCn);
        } else return;
        listData = listData.list;
        const nextUrl = new URL(this.noticeBaseUrl);
        if (listData !== undefined) {
            listData.forEach((element: MedPageSummary) => {
                if (Number.isNaN(+element.rn)) return;
                nextUrl.searchParams.set('bbsId', 'BBSMSTR_000000000001');
                nextUrl.searchParams.set('upper_menu_id', '3000000');
                nextUrl.searchParams.set('menu_no', '3010000');
                nextUrl.searchParams.set('nttId', element.nttId);
                const link = nextUrl.href;
                if (link === undefined) return;
                const dateString = element.frstRegistPnttm;
                const tag = element.codeNm;
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

            const page: number = +(new URL(url).searchParams.get('pageIndex') ?? '1');

            if (listData.length > 0) {
                const nextListUrlInstance = new URL(this.nextListBaseUrl);
                nextListUrlInstance.searchParams.set('pageIndex', (page + 1).toString());
                nextListUrlInstance.searchParams.set('bbsId', 'BBSMSTR_000000000001');
                nextListUrlInstance.searchParams.set('recordCountPerPage', '10');
                nextListUrlInstance.searchParams.set('more', 'Y');

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
    baseUrl: 'https://medicine.snu.ac.kr/fnt/nac/selectNoticeList.do?bbsId=BBSMSTR_000000000001',
});
