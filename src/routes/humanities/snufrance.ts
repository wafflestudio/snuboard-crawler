import { URL } from 'url';

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
    parseTitle,
    saveNotice,
} from '../../utils.js';

class SnuFranceCrawler extends Crawler {
    handlePage = async (context: CheerioCrawlingContext<SiteData, any>): Promise<void> => {
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
                if (imgSrc && !imgSrc.startsWith('data')) {
                    $(element).attr('src', absoluteLink(imgSrc, this.baseUrl) ?? '');
                }
            });

            const notice = await getOrCreate(Notice, { link: url }, false);
            notice.department = siteData.department;
            notice.departmentCode = departmentCode(siteData.department.name);

            // find category in stat.snu.ac.kr & geog.snu.ac.kr
            notice.title = $('div.title').text().trim();

            const contentElement = $('div.bbsCONTENTS2');
            const content =
                load(contentElement.html() ?? '', {
                    // @ts-ignore

                    decodeEntities: false,
                })('body').html() ?? '';
            // ^ encode non-unicode letters with utf-8 instead of HTML encoding
            notice.content = content;
            notice.contentText = contentElement.text().trim(); // texts are automatically utf-8 encoded
            const fullDateString = $('div.ri_box dl dd').text().trim();
            notice.createdAt = strptime(fullDateString, '%Y-%m-%d %p %H:%M:%S');
            notice.isPinned = siteData.isPinned;
            notice.link = url;
            await saveNotice(notice);

            const files: File[] = [];
            $('div.le_box dl dd a').each((index, element) => {
                const fileParams = $(element)
                    .attr('onclick')
                    ?.match(/'[^']+'/g);
                if (fileParams === null || fileParams === undefined) return;
                const fileParams2 = fileParams.map((param) => {
                    return param.slice(1, -1);
                });
                const fileUrlInstance = new URL('http://www.snufrance.com/__admopt/__class/__download.asp');
                fileUrlInstance.searchParams.set('pathUrl', fileParams2[0]);
                fileUrlInstance.searchParams.set('filename', fileParams2[1]);
                fileUrlInstance.searchParams.set('realname', fileParams2[2]);
                const file = new File();

                file.name = $(element).text().trim();
                file.link = fileUrlInstance.href;
                files.push(file);
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
        }
    };

    handleList = async (context: CheerioCrawlingContext<SiteData, any>, requestQueue: RequestQueue): Promise<void> => {
        const { request, $ } = context;
        const { url } = request;
        const siteData = <SiteData>request.userData;
        this.log.info('Page opened.', { url });
        const urlInstance = new URL(url);
        const page = +(urlInstance.searchParams.get('curpage') ?? '1');

        if ($) {
            $('table.bbsL tbody tr').each((index, element) => {
                const titleElement = $(element).find('td:nth-child(2) a');
                const idx = titleElement.attr('onclick')?.replace(/[^0-9]/g, '');
                if (idx === undefined) return;
                const formElement = $('form[name="viewForm"]');
                if (request.loadedUrl === undefined) throw new TypeError('request.loadedUrl is undefined');
                const nextUrl = new URL(request.loadedUrl);
                if (nextUrl === undefined) return;
                nextUrl.searchParams.set('idx', idx);
                formElement.children('input').each((index2, element2) => {
                    const elem = $(element2);
                    const name = elem.attr('name');
                    if (name === undefined) return;
                    if (name === 'idx') return;
                    nextUrl.searchParams.set(name, elem.attr('value') || '');
                });
                nextUrl.searchParams.delete('curpage');
                const dateString = $(element).find('td:nth-child(3)').text().trim();
                const link = nextUrl.href;
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

            const lastPageString = $('a.wcyr_next_e')
                .attr('onclick')
                ?.replace(/[^0-9]/g, '');
            if (lastPageString === undefined) return;

            if (page < +lastPageString) {
                const nextListUrlInstance = new URL(url);
                nextListUrlInstance.searchParams.set('curpage', `${page + 1}`);

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
        }
    };
}

export const snuFrance = new SnuFranceCrawler({
    departmentName: '불어불문학과',
    departmentCode: 'snufrance',
    departmentCollege: HUMANITIES,
    departmentLink: 'https://snufrance.com/home/main/index.asp',
    baseUrl: 'https://www.snufrance.com/home/opsquare/notice.asp',
});
