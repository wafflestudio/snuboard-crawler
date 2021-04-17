// filename must equal to first level of url domain.
// e.g. ee.snu.ac.kr -> ee.ts

import { RequestQueue } from 'apify';
import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { load } from 'cheerio';
import { URL } from 'url';
import { File, Notice } from '../../../server/src/notice/notice.entity.js';
import { CategoryCrawlerInit, SiteData } from '../../types/custom-types';
import { absoluteLink, getOrCreate, getOrCreateTags, saveNotice } from '../../utils';
import { strptime } from '../../micro-strptime';
import { CategoryCrawler } from '../../classes/categoryCrawler';
import { ENGINEERING } from '../../constants';

class EECrawler extends CategoryCrawler {
    private readonly excludeTags: string[];

    constructor(initData: CategoryCrawlerInit) {
        super(initData);
        this.excludeTags = ['sugang', 'yonhapai'];
    }

    handlePage = async (context: CheerioHandlePageInputs): Promise<void> => {
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
            const title = $('div#bbs-view-wrap').children('h1').text();
            notice.title = title;
            const contentElement = $('div.cnt');

            const content = load(contentElement.html() ?? '', { decodeEntities: false })('body').html() ?? '';
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
            if (!this.excludeTags.includes(category) && title.startsWith('[')) {
                tags.push(title.slice(1, title.indexOf(']')).trim());
            }
            await getOrCreateTags(tags, notice, siteData.department);
        } else {
            throw new TypeError('Selector is undefined');
        }
    };

    handleList = async (context: CheerioHandlePageInputs, requestQueue: RequestQueue): Promise<void> => {
        const { request, $ } = context;
        const { url } = request;
        const siteData = <SiteData>request.userData;
        this.log.info('Page opened.', { url });

        if ($ !== undefined) {
            $('div.bbs-blogstyle ul li').each((index, element) => {
                const titleElement = $(element).children('a').first();
                // const title = titleElement.children('strong').first().text();
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
                    dateString,
                };
                this.log.info('Enqueueing', { link });
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
});
