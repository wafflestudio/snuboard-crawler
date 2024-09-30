// filename must equal to first level of url domain.
// e.g. oia.snu.ac.kr -> oia.ts

import { URL } from 'url';

import { RequestQueue } from 'apify';
import { load } from 'cheerio';
import { CheerioCrawlingContext } from 'crawlee';

import { Notice, File } from '../../../server/src/notice/notice.entity.js';
import { Crawler } from '../../classes/crawler.js';
import { ETC } from '../../constants.js';
import { strptime } from '../../micro-strptime.js';
import { CategoryTag, SiteData } from '../../types/custom-types';
import { absoluteLink, departmentCode, getOrCreate, getOrCreateTagsWithMessage, saveNotice } from '../../utils.js';

class OIACrawler extends Crawler {
    handlePage = async (context: CheerioCrawlingContext<SiteData, any>): Promise<void> => {
        const { request, $ } = context;
        const { url } = request;
        const siteData = <SiteData>request.userData;

        this.log.info('Page opened.', { url });
        if ($ !== undefined) {
            const notice = await getOrCreate(Notice, { link: url }, false);

            notice.department = siteData.department;
            notice.departmentCode = departmentCode(siteData.department.name);
            const title = $('#bltnTitle').text().trim();
            notice.title = title;
            const contentElement = $('#print > table.table_type01.view > tbody > tr:nth-child(1) > td');
            const content =
                load(contentElement.html() ?? '', {
                    // @ts-ignore

                    decodeEntities: false,
                })('body').html() ?? '';
            notice.content = content;
            notice.contentText = contentElement.text().trim(); // texts are automatically utf-8 encoded
            notice.createdAt = strptime(siteData.dateString, '%Y.%m.%d');

            notice.isPinned = siteData.isPinned;
            notice.link = url;

            await saveNotice(notice);

            const files: File[] = [];
            $('ul.file_list li a').each((index, element) => {
                const fileUrl = $(element).attr('href');
                if (fileUrl) {
                    const file = new File();
                    file.name = $(element).text().trim();
                    file.link = absoluteLink(fileUrl, this.baseUrl) ?? notice.link;
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

            const tags: string[] = ['공지사항'];
            await getOrCreateTagsWithMessage(tags, notice, siteData.department);
        } else {
            throw new TypeError('Selector is undefined');
        }
    };

    handleList = async (context: CheerioCrawlingContext<SiteData, any>, requestQueue: RequestQueue): Promise<void> => {
        const { request, $ } = context;
        const { url } = request;
        const siteData = <SiteData>request.userData;
        this.log.info('Page opened.', { url });

        if ($ !== undefined) {
            $('tbody tr').each((index, element) => {
                const titleElement = $(element).find('td.subject div a');
                const s = titleElement.attr('href');
                if (s === undefined) return;
                const apiBoardNum = s.trim().match(/Bulletin\('([0-9]+)','([0-9]+)'\)/)?.[1];
                const apiNoticeNum = s.trim().match(/Bulletin\('([0-9]+)','([0-9]+)'\)/)?.[2];
                const link = `https://board.snu.ac.kr/apiboard/${apiBoardNum}/${apiNoticeNum}`;
                const dateString = $(element).find('td:nth-child(4)').text().trim();
                if (!dateString) return;
                const noticeNum = $(element).children('td').first().text().trim();
                const isPinned = noticeNum === '공지';
                const newSiteData: SiteData = {
                    department: siteData.department,
                    isPinned,
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

            const urlInstance = new URL(url);
            const page: number = +(urlInstance.searchParams.get('page') ?? 1);
            const lastNoticeId = $('table tbody tr').last().children('td').first().text().trim();
            if (!lastNoticeId || Number.isNaN(+lastNoticeId)) return;
            if (+lastNoticeId > 1) {
                const nextListUrlInstance = new URL(url);
                nextListUrlInstance.searchParams.set('page', `${page + 1}`);
                const nextList: string = nextListUrlInstance.href;
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
        } else {
            throw new TypeError('Selector is undefined');
        }
    };
}

export const oia = new OIACrawler({
    departmentName: '국제협력본부',
    departmentCode: 'oia',
    baseUrl: 'https://board.snu.ac.kr/apiboard/512?boardId=512&cmpBrdId=512&pageSize=10',
    departmentCollege: ETC,
});
