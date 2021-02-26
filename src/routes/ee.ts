// filename must equal to first level of url domain.
// e.g. ee.snu.ac.kr -> ee.ts

import assert from 'assert';
import * as Apify from 'apify';
import {CheerioHandlePageInputs} from 'apify/types/crawlers/cheerio_crawler';
import {RequestQueue} from 'apify';
import {load} from 'cheerio';
import {Connection} from 'typeorm';
import {Notice, File} from '../../server/src/notice/notice.entity.js';
import {categoryTag, SiteData} from '../types/custom-types';
import {absoluteLink, getOrCreate, getOrCreateTags, runCrawler, saveNotice} from '../utils';
import {Department} from '../../server/src/department/department.entity';
import {strptime} from '../micro-strptime';
import {URL} from "url";

const {
    utils: {log},
} = Apify;
const departmentName = '전기정보공학부';
const departmentCode = 'ee'; // this value must be equal to the filename
const eeBaseUrl = 'https://ee.snu.ac.kr/community/notice/';
const eeCategories = [
    'academic',
    'scholarship',
    'admissions',
    'campuslife',
    'jobs',
    'sugang',
    'yonhapai'
];
const eeCategoryTags: categoryTag = {
    sugang: '수강',
    yonhapai: '인공지능'
};

export async function handlePage(context: CheerioHandlePageInputs): Promise<void> {
    const {request, $} = context;
    const {url} = request;
    const siteData = <SiteData>request.userData;

    log.info('Page opened.', {url});
    if ($) {
        // creation order
        // dept -> notice -> file
        //                -> tag -> notice_tag

        const notice = await getOrCreate(Notice, {link: url}, false);

        notice.department = siteData.department;
        const title = $('div#bbs-view-wrap').children('h1').text();
        notice.title = title;
        const contentElement = $('div.cnt');

        let content = load(contentElement.html() ?? '',
            {decodeEntities: false})('body').html() ?? '';
        // ^ encode non-unicode letters with utf-8 instead of HTML encoding
        notice.content = content;
        notice.preview = contentElement.text().substring(0, 1000).trim(); // texts are automatically utf-8 encoded

        notice.createdAt = strptime(siteData.dateString, '%Y-%m-%d');
        notice.isPinned = siteData.isPinned;
        notice.link = url;

        await saveNotice(notice);

        const files: File[] = [];
        $('div.att-file ul li div').each(function (index, element) {
            const fileUrl = $(element).children('a').attr('href');
            if (fileUrl) {
                const file = new File();
                file.name = $(element).text().trim();
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

        const category = url.replace(eeBaseUrl, '').split('?')[0]
        const tags = [category in eeCategoryTags ?
            eeCategoryTags[category]
            : title.slice(1, title.indexOf(']')).trim()];
        await getOrCreateTags(tags, notice, siteData.department);
    }
}

export async function handleList(context: CheerioHandlePageInputs, requestQueue: RequestQueue): Promise<void> {
    const {request, $} = context;
    const {url} = request;
    const siteData = <SiteData>request.userData;
    log.info('Page opened.', {url});

    if ($) {
        $('div.bbs-blogstyle ul li').each((index, element) => {
            const titleElement = $(element).children('a').first();
            // const title = titleElement.children('strong').first().text();
            const link = absoluteLink(titleElement.attr('href'), request.loadedUrl);
            if (link === undefined) return;
            const dateString = $(element).find('p.date span').text().split('l')[1].trim();

            const newSiteData: SiteData = {
                department: siteData.department,
                isPinned: false,
                isList: false,
                dateString: dateString,
            };
            log.info('Enqueueing', {link});
            requestQueue.addRequest({
                url: link,
                userData: newSiteData,
            });
        });

        const endElement = $('div.pagination-01').children('a.direction.next').last().attr('href');
        const endUrl = absoluteLink(endElement, request.loadedUrl);

        if (!endUrl) return;
        const endUrlInstance = new URL(endUrl);
        const urlInstance = new URL(url);
        const page: number = +(urlInstance.searchParams.get('page') ?? 1);
        const endPage = endUrlInstance.searchParams.get('page');

        if (endPage && page < +endPage) {
            urlInstance.searchParams.set('page', (page + 1).toString());

            const nextList: string = urlInstance.href;
            log.info('Enqueueing list', {nextList});
            const nextListSiteData: SiteData = {
                department: siteData.department,
                isPinned: false,
                isList: true,
                dateString: '',
            };
            await requestQueue.addRequest({
                url: nextList,
                userData: nextListSiteData,
            });
        }
    }
}


export async function startCrawl(connection: Connection): Promise<void> {
    assert(connection.isConnected);
    log.info('Starting crawl for '.concat(departmentName));
    const requestQueue = await Apify.openRequestQueue(departmentCode); // each queue should have different id
    const department = await getOrCreate(Department, {name: departmentName});

    // department-specific initialization urls
    const siteData: SiteData = {department, isList: true, isPinned: false, dateString: ''};
    for (const category of eeCategories) {
        await requestQueue.addRequest({
            url: eeBaseUrl + category,
            userData: siteData,
        });
    }

    await runCrawler(requestQueue, handlePage, handleList);
}
