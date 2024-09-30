import { RequestQueue } from 'apify';
import { load } from 'cheerio';
import { CheerioCrawlingContext } from 'crawlee';

import { File, Notice } from '../../../server/src/notice/notice.entity.js';
import { Crawler } from '../../classes/crawler.js';
import { HUMANITIES, INF } from '../../constants.js';
import { strptime } from '../../micro-strptime.js';
import { SiteData } from '../../types/custom-types';
import {
    absoluteLink,
    departmentCode,
    getOrCreate,
    getOrCreateTagsWithMessage,
    removeUrlPageParam,
    saveNotice,
} from '../../utils.js';

export class PhilosophyCralwer extends Crawler {
    protected override readonly encoding: string = 'EUC-KR';

    handlePage = async (context: CheerioCrawlingContext<SiteData, any>): Promise<void> => {
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
                if (imgSrc) {
                    $(element).attr('src', absoluteLink(imgSrc, this.baseUrl) ?? '');
                }
            });
            const notice = await getOrCreate(Notice, { link: url }, false);

            notice.department = siteData.department;
            notice.departmentCode = departmentCode(siteData.department.name);
            const noticeElement = $('table.view tbody');
            notice.title = noticeElement.find('tr th.view_subj').text().trim();
            const contentElement = noticeElement.find('td.vie_txt');
            let content = contentElement.html() ?? '';
            content =
                load(content, {
                    // @ts-ignore

                    decodeEntities: false,
                })('body')
                    .html()
                    ?.trim() ?? '';
            // ^ encode non-unicode letters with utf-8 instead of HTML encoding
            notice.content = content;
            notice.contentText = contentElement.text().trim(); // texts are automatically utf-8 encoded
            const fullDateString: string = noticeElement.find('tr:nth-child(3)').find('td').first().text().trim();
            // example: '2021-02-26 11:34'
            notice.createdAt = strptime(fullDateString, '%Y-%m-%d %H:%M');

            notice.isPinned = siteData.isPinned;

            notice.link = url;

            await saveNotice(notice);

            const files: File[] = [];
            $('a.tbl_file').each((index, element) => {
                const fileRe = /\.\.\/\.\.\/.+',/;
                const fileUrl = $(element).attr('href');
                if (fileUrl) {
                    const file = new File();
                    file.name = $(element).text().trim();
                    file.link = `http://philosophy.snu.ac.kr/board/${fileUrl.match(fileRe)?.[0].slice(6, -2)}`;
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
            const tags: string[] = [siteData.tag ?? '미분류'];

            await getOrCreateTagsWithMessage(tags, notice, siteData.department);
        } else {
            throw new TypeError('Selector is undefined');
        }
    };

    handleList = async (context: CheerioCrawlingContext<SiteData, any>, requestQueue: RequestQueue): Promise<void> => {
        const { request, $ } = context;
        const { url } = request;
        const siteData = <SiteData>request.userData;
        let lastNoticeId = INF;
        this.log.info('Page opened.', { url });
        if ($ !== undefined) {
            const urlInstance = new URL(url);
            const pageString = urlInstance.searchParams.get('page') ?? '0';
            const page: number = +(pageString === '' ? '0' : pageString);
            // example:  url~/page/{page}?pmove~ ->

            $('table.list tbody tr').each((index, element) => {
                const noticeNum = $(element).children('td').first().text().trim();
                const isPinned = noticeNum === '';
                if (page > 1 && isPinned) return;

                if (!isPinned) {
                    lastNoticeId = Math.min(lastNoticeId, +noticeNum);
                }

                const titleElement = $(element).find('td.suj a');
                // const title = titleElement.text();
                const category = $(element).find('td:nth-child(2)').text().trim();

                if (request.loadedUrl === undefined) throw new TypeError('request.loadedUrl is undefined');
                const link = removeUrlPageParam(absoluteLink(titleElement.attr('href'), request.loadedUrl));
                if (link === undefined) return;

                const dateString = $($(element).children('td')[4]).text().trim();

                const newSiteData: SiteData = {
                    department: siteData.department,
                    isPinned,
                    isList: false,
                    dateString,
                    tag: category,
                };
                this.log.info('Enqueueing', { link });
                requestQueue.addRequest({
                    url: link,
                    userData: newSiteData,
                });
            });

            const nextListUrlInstance = new URL(url);
            nextListUrlInstance.searchParams.set('page', `${page + 1}`);
            const nextList = nextListUrlInstance.href;
            // +lastNoticeId === 0  <==> loaded page is the last page
            if (+lastNoticeId > 0) {
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
            throw new TypeError('Selector is undefined');
        }
    };
}

export const philosophy = new PhilosophyCralwer({
    departmentName: '철학과',
    departmentCode: 'philosophy', // this value must be equal to the filename
    departmentCollege: HUMANITIES,
    baseUrl: 'http://philosophy.snu.ac.kr/board/html/menu6/sub06_list.html',
});
