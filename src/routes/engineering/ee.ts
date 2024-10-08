// filename must equal to first level of url domain.
// e.g. ee.snu.ac.kr -> ee.ts

import { URL } from 'url';

import { RequestQueue } from 'apify';
import { load } from 'cheerio';
import { CheerioCrawlingContext } from 'crawlee';

import { File, Notice } from '../../../server/src/notice/notice.entity.js';
import { CategoryCrawler } from '../../classes/categoryCrawler.js';
import { ENGINEERING } from '../../constants.js';
import { strptime } from '../../micro-strptime.js';
import { CategoryCrawlerInit, SiteData } from '../../types/custom-types';
import { absoluteLink, departmentCode, getOrCreate, getOrCreateTagsWithMessage, saveNotice } from '../../utils.js';

class EECrawler extends CategoryCrawler {
    private readonly excludeTags: string[];

    constructor(initData: CategoryCrawlerInit) {
        super(initData);
        this.excludeTags = ['sugang', 'yonhapai'];
    }

    override handlePage = async (context: CheerioCrawlingContext<SiteData, any>): Promise<void> => {
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
                $(element).attr('src', absoluteLink(imgSrc, this.baseUrl) ?? '');
            });
            const notice = await getOrCreate(Notice, { link: url }, false);

            notice.department = siteData.department;
            notice.departmentCode = departmentCode(siteData.department.name);
            const title = $('div#bbs-view-wrap').children('h1').text();
            notice.title = title;
            const contentElement = $('div.cnt');

            const content =
                load(contentElement.html() ?? '', {
                    // @ts-ignore

                    decodeEntities: false,
                })('body').html() ?? '';
            // ^ encode non-unicode letters with utf-8 instead of HTML encoding
            notice.content = content;
            notice.contentText = contentElement.text().trim(); // texts are automatically utf-8 encoded

            notice.createdAt = strptime(siteData.dateString, '%Y-%m-%d');
            notice.isPinned = siteData.isPinned;
            notice.link = url;

            await saveNotice(notice);

            const files: File[] = [];
            $('div.att-file ul li div').each((index, element) => {
                const fileUrl = $(element).children('a').attr('href');
                if (fileUrl) {
                    const file = new File();
                    file.name = $(element).text().trim();
                    file.link = url;
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

            const category = url.replace(this.baseUrl, '').split('?')[0];
            const tags = [this.categoryTags[category]];
            await getOrCreateTagsWithMessage(tags, notice, siteData.department);
        } else {
            throw new TypeError('Selector is undefined');
        }
    };

    override handleList = async (
        context: CheerioCrawlingContext<SiteData, any>,
        requestQueue: RequestQueue,
    ): Promise<void> => {
        const { request, $ } = context;
        const { url } = request;
        const siteData = <SiteData>request.userData;
        this.log.info('Page opened.', { url });

        if ($ !== undefined) {
            $('div.bbs-blogstyle ul li').each((index, element) => {
                const titleElement = $(element).children('a').first();
                // const title = titleElement.children('strong').first().text();
                if (request.loadedUrl === undefined) throw new TypeError('request.loadedUrl is undefined');
                let link = absoluteLink(titleElement.attr('href'), request.loadedUrl);
                if (link === undefined) return;
                const pageUrl = new URL(link);
                pageUrl.searchParams.delete('page');
                link = pageUrl.href;
                const dateString = $(element).find('p.date span').text().split('l')[1].trim();

                const newSiteData: SiteData = {
                    department: siteData.department,
                    isPinned: false,
                    isList: false,
                    commonUrl: siteData.commonUrl,
                    dateString,
                };
                this.log.info('Enqueueing', { link });
                requestQueue.addRequest({
                    url: link,
                    userData: newSiteData,
                });
            });

            const endElement = $('div.pagination-01').children('a.direction.next').last().attr('href');
            if (request.loadedUrl === undefined) throw new TypeError('request.loadedUrl is undefined');
            const endUrl = absoluteLink(endElement, request.loadedUrl);

            if (!endUrl) return;
            const endUrlInstance = new URL(endUrl);
            const urlInstance = new URL(url);
            const page: number = +(urlInstance.searchParams.get('page') ?? 1);
            const endPage = endUrlInstance.searchParams.get('page');

            if (endPage && page < +endPage) {
                urlInstance.searchParams.set('page', (page + 1).toString());

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
        } else {
            throw new TypeError('Selector is undefined');
        }
    };
}

export const ee = new EECrawler({
    departmentName: '전기정보공학부',
    departmentCode: 'ee',
    baseUrl: 'https://ee.snu.ac.kr/community/notice/',
    departmentCollege: ENGINEERING,
    categoryTags: {
        academic: '학사',
        scholarship: '장학',
        admissions: '입시&기타',
        campuslife: '대학생활',
        jobs: '취업&전문연',
        sugang: '수강',
        yonhapai: '인공지능',
    },
    style: 'ol { list-style-type : none;}',
});
