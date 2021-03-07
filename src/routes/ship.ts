// filename must equal to first level of url domain.
// e.g. cse.snu.ac.kr -> cse.ts

import assert from 'assert';
import * as Apify from 'apify';
import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { RequestQueue } from 'apify';
import { load } from 'cheerio';
import { Connection } from 'typeorm';
import { Notice, File } from '../../server/src/notice/notice.entity.js';
import { SiteData } from '../types/custom-types';
import { absoluteLink, getOrCreate, getOrCreateTags, runCrawler, saveNotice } from '../utils';
import { Department } from '../../server/src/department/department.entity';
import { strptime } from '../micro-strptime';
import { Crawler } from '../classes/crawler';

class ShipCrawler extends Crawler {
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
            notice.title = $('div.title h1 a').text().trim();
            const contentElement = $('div.xe_content');
            let content = contentElement.html() ?? '';
            content = load(content, { decodeEntities: false })('body').html() ?? '';
            // ^ encode non-unicode letters with utf-8 instead of HTML encoding
            notice.content = content;
            notice.preview = contentElement.text().substring(0, 1000).trim(); // texts are automatically utf-8 encoded

            try{
                const fullDateString: string = $('div.date').text().trim();
                notice.createdAt = strptime(fullDateString, '%Y.%m.%d %H:%M:%S');
            }catch {
                notice.createdAt = strptime(siteData.dateString,'%Y-%m-%d')
            }

            notice.isPinned = siteData.isPinned;
            notice.link = url;

            await saveNotice(notice);

            const files: File[] = [];
            $('div.fileAttached ul li a').each((index, element) => {
                const fileUrl = $(element).attr('href');
                if (fileUrl) {
                    const file = new File();
                    file.name = $(element).text().trim();
                    file.link = absoluteLink(fileUrl, this.baseUrl) ?? '';
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

            let tags: string[] = [];
            const category = $('div.category a').text().trim();
            tags.push(category);
            await getOrCreateTags(tags, notice, siteData.department);
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
            // example:  /ko/board/Scholarship/page/2 => ['', 'ko', 'board', 'Scholarship','page','2']

            $('table.boardList tr').each((index, element) => {
                const isPinned = $(element).children('td.notice').length !== 0;
                if (page > 1 && isPinned) return;

                const titleElement = $(element).find('td.title a').first();
                // const title = titleElement.text();
                const link = absoluteLink(titleElement.attr('href'), request.loadedUrl);
                if (link === undefined) return;
                const dateString = $(element).children('td.date').text();

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

            const endUrlInstance = new URL(absoluteLink($('div.pagination.a1 a.nextEnd').attr('href'),url) ?? '');
            if(!endUrlInstance) return;

            const endPage = +(endUrlInstance.searchParams.get('page') ?? 1);
            // +lastNoticeId === 1  <==> loaded page is the last page
            if (page < endPage) {
                const nextListInstance = new URL(urlInstance.href);
                nextListInstance.searchParams.set('page',(page+1).toString());

                this.log.info('Enqueueing list', { nextList:nextListInstance.href });

                const nextListSiteData: SiteData = {
                    department: siteData.department,
                    isPinned: false,
                    isList: true,
                    dateString: '',
                };

                await requestQueue.addRequest({
                    url: nextListInstance.href,
                    userData: nextListSiteData,
                });
            }
        }
    };

}

export const ship = new ShipCrawler({
    departmentName: '조선해양공학과',
    departmentCode: 'ship', // this value must be equal to the filename,
    baseUrl: 'http://ship.snu.ac.kr/index.php?mid=Notice',
});
