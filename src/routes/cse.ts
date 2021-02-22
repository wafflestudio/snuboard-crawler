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

const {
    utils: { log },
} = Apify;
const departmentName = '컴퓨터공학부';
const departmentId = 'cse'; // this value must be equal to the filename

export async function handlePage(context: CheerioHandlePageInputs): Promise<void> {
    const { request, $ } = context;
    const { url } = request;
    const siteData = <SiteData>request.userData;

    log.info('Page opened.', { url });
    if ($) {
        // creation order
        // dept -> notice -> file
        //                -> tag -> notice_tag

        const notice = await getOrCreate(Notice, { link: url }, false);

        notice.department = siteData.department;
        notice.title = $('h1#page-title').text().trim();

        const contentElement = $('div.field-name-body');
        let content = contentElement.children('div').children('div').html() ?? '';
        content = load(content, { decodeEntities: false })('body').html() ?? '';
        // ^ encode non-unicode letters with utf-8 instead of HTML encoding
        notice.content = content;
        notice.preview = contentElement.text().substring(0, 1000); // texts are automatically utf-8 encoded

        // const dateString: string = $('div.submitted').text().split(',')[1].substring(8).trim().split(' ')[0];
        // TODO parse time
        const dateParts = siteData.dateString.split('/');
        notice.createdAt = new Date(+dateParts[0], +dateParts[1] - 1, +dateParts[2]);

        notice.isPinned = siteData.isPinned;

        notice.link = url;

        // author: $('span.username').text().trim()

        await saveNotice(notice);

        const files: File[] = [];
        $('span.file').each(function (index, element) {
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

        const tags = $('div.field-name-field-tag').text().substring(4).trim().split(', ');
        await getOrCreateTags(tags, notice, siteData.department);
    }
}

export async function handleList(context: CheerioHandlePageInputs, requestQueue: RequestQueue): Promise<void> {
    const { request, $ } = context;
    const { url } = request;
    const siteData = <SiteData>request.userData;
    log.info('Page opened.', { url });
    if ($) {
        $('table.views-table tbody tr').each(function (index, element) {
            const isPinned = $(element).attr('class')?.split(' ').includes('sticky') ?? false;
            const titleElement = $($($(element).children('td')[0]).children('a'));
            // const title = titleElement.text();
            const link = absoluteLink(titleElement.attr('href'), request.loadedUrl);
            if (link === undefined) return;
            const dateString = $($(element).children('td')[1]).text().trim();
            // const viewCount = +$($(element).children('td')[2]).text().trim() ?? 0;

            const newSiteData: SiteData = {
                department: siteData.department,
                isPinned,
                isList: false,
                dateString,
            };
            log.info('Enqueueing', { link });
            requestQueue.addRequest({
                url: link,
                userData: newSiteData,
            });
        });

        const nextList = absoluteLink($('li.pager-next').children('a').attr('href'), request.loadedUrl);
        if (nextList === undefined) return;
        log.info('Enqueueing list', { nextList });

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

export async function startCrawl(connection: Connection): Promise<void> {
    assert(connection.isConnected);
    log.info('Starting crawl for '.concat(departmentName));
    const requestQueue = await Apify.openRequestQueue(departmentId); // each queue should have different id
    const department = await getOrCreate(Department, { name: departmentName });

    // department-specific initialization urls
    const siteData: SiteData = { department, isList: true, isPinned: false, dateString: '' };
    await requestQueue.addRequest({
        url: 'https://cse.snu.ac.kr/department-notices',
        userData: siteData,
    });

    await runCrawler(requestQueue, handlePage, handleList);
}
