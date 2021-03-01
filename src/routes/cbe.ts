import assert from 'assert';
import * as Apify from 'apify';
import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { RequestQueue } from 'apify';
import { load } from 'cheerio';
import { Connection } from 'typeorm';
import { Notice, File } from '../../server/src/notice/notice.entity.js';
import { SiteData, categoryTag } from '../types/custom-types';
import { absoluteLink, getOrCreate, getOrCreateTags, runCrawler, saveNotice } from '../utils';
import { Department } from '../../server/src/department/department.entity';
import { strptime } from '../micro-strptime';

const {
    utils: { log },
} = Apify;
const departmentName = '화학생물공학부';
const departmentCode = 'cbe'; // this value must be equal to the filename
const baseurl = 'https://cbe.snu.ac.kr/ko/board/';

const categories = ['notice', 'college2', 'postgraduate_school', 'seminar', 'free_board', 'Scholarship'];
const categoryTags: categoryTag = {
    notice: '학부&대학원',
    college2: '학부',
    postgraduate_school: '대학원',
    seminar: '세미나',
    free_board: '자유게시판',
};

const excludedTag = '미분류';

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
        notice.title = $('dl.cHeader dt').text().trim();
        const contentElement = $('div.postArea');
        let content = contentElement.html() ?? '';
        content = load(content, { decodeEntities: false })('body').html() ?? '';
        // ^ encode non-unicode letters with utf-8 instead of HTML encoding
        notice.content = content;
        notice.preview = contentElement.text().substring(0, 1000).trim(); // texts are automatically utf-8 encoded
        const fullDateString: string = $('li.regdate').text().substring(2).trim();
        // example: '2021-02-26 11:34:01'
        notice.createdAt = strptime(fullDateString, '%Y-%m-%d %H:%M:%S');

        notice.isPinned = siteData.isPinned;

        notice.link = url;

        await saveNotice(notice);

        const files: File[] = [];
        $('a.down').each((index, element) => {
            const fileUrl = $(element).attr('href');
            if (fileUrl) {
                const file = new File();
                file.name = $(element).text().trim();
                file.link = absoluteLink(fileUrl, baseurl) ?? '';
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
        $('li.category').each((index, element) => {
            tags.push($(element).text().substring(4).trim());
        });
        const category: string = url.split('/')[5];
        if (categoryTags[category] && !tags.includes(categoryTags[category])) {
            tags.push(categoryTags[category]);
        }
        tags = tags.filter((tag) => tag !== excludedTag);
        await getOrCreateTags(tags, notice, siteData.department);
    }
}

export async function handleList(context: CheerioHandlePageInputs, requestQueue: RequestQueue): Promise<void> {
    const { request, $ } = context;
    const { url } = request;
    const siteData = <SiteData>request.userData;
    log.info('Page opened.', { url });
    if ($) {
        const urlInstance = new URL(url);
        const page: number = +(urlInstance.pathname.split('/')[5] ?? 1);
        // example:  /ko/board/Scholarship/page/2 => ['', 'ko', 'board', 'Scholarship','page','2']

        $('table.lc01 tbody tr').each((index, element) => {
            const isPinned = $(element).children('td').first().text().trim() === '공지';
            if (page > 1 && isPinned) return;

            const titleElement = $($(element).find('a'));
            // const title = titleElement.text();

            const link = absoluteLink(titleElement.attr('href'), request.loadedUrl);
            if (link === undefined) return;
            const dateString = $($(element).children('td')[4]).text().trim();

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

        const nextList = absoluteLink(`${urlInstance.pathname}/page/${page + 1}`, request.loadedUrl);
        if (!nextList) return;

        const lastNoticeId: string | undefined = $('table.lc01 tbody tr').last().children('td').first().text().trim();
        if (!lastNoticeId || Number.isNaN(+lastNoticeId)) return;

        // +lastNoticeId === 1  <==> loaded page is the last page
        if (+lastNoticeId > 1) {
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
}

export async function startCrawl(connection: Connection): Promise<void> {
    assert(connection.isConnected);
    log.info('Starting crawl for '.concat(departmentName));
    const requestQueue = await Apify.openRequestQueue(departmentCode); // each queue should have different id
    const department = await getOrCreate(Department, { name: departmentName });

    // department-specific initialization urls
    const siteData: SiteData = { department, isList: true, isPinned: false, dateString: '' };

    Promise.all(
        categories.map(async (category) => {
            await requestQueue.addRequest({
                url: baseurl + category,
                userData: siteData,
            });
        }),
    );

    await runCrawler(requestQueue, handlePage, handleList);
}
