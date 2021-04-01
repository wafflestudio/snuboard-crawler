import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { load } from 'cheerio';
import { URL } from 'url';
import { RequestQueue } from 'apify';
import { CategoryCrawler } from '../../classes/categoryCrawler';
import { CategoryCrawlerInit, CategoryTag, ChemPageSummary, SiteData } from '../../types/custom-types';
import { absoluteLink, getOrCreate, getOrCreateTags, removeUrlPageParam, saveNotice } from '../../utils';
import { File, Notice } from '../../../server/src/notice/notice.entity';
import { strptime } from '../../micro-strptime';
import { ENGINEERING, SCIENCE } from '../../constants';

class ChemCrawler extends CategoryCrawler {
    protected readonly encoding: string = 'EUC-KR';

    protected readonly maxRetries: number = 5;

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
            const title = $('div.view_title strong').text();
            notice.title = title;
            const bodyElement = $('div.view_body');
            bodyElement.find('div.view_bottom').remove();
            const contentElement = bodyElement.find('p').first();

            const content = load(contentElement.html() ?? '', { decodeEntities: false })('body').html() ?? '';
            // ^ encode non-unicode letters with utf-8 instead of HTML encoding
            notice.content = content;
            notice.contentText = contentElement.text().trim(); // texts are automatically utf-8 encoded
            notice.createdAt = strptime(siteData.dateString, '%Y.%m.%d');

            notice.isPinned = siteData.isPinned;
            notice.link = url;

            await saveNotice(notice);

            const files: File[] = [];
            bodyElement.find('p').first().remove();
            bodyElement.find('a').each((index, element) => {
                const fileUrl = $(element).attr('href');
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

            const code: string = new URL(url).searchParams.get('code') ?? '';
            const codeTags: CategoryTag = {
                '001001': '공지사항',
                '001004': '취업',
            };
            const tags = [codeTags[code] ?? '미분류'];
            await getOrCreateTags(tags, notice, siteData.department);
        } else {
            throw new TypeError('Selector is undefined');
        }
    };

    handleList = async (context: CheerioHandlePageInputs, requestQueue: RequestQueue): Promise<void> => {
        const { request, body } = context;
        const { url } = request;
        const siteData = <SiteData>request.userData;
        this.log.info('Page opened.', { url });
        let listData;
        const urlInstance = new URL(request.loadedUrl);
        const nextPageUrlInstance = new URL(urlInstance.href.replace('data', 'view'));

        if (typeof body === 'string') {
            listData = JSON.parse(body);
        } else return;

        if (listData !== undefined) {
            listData.forEach((element: ChemPageSummary) => {
                if (Number.isNaN(+element.seqno)) return;
                nextPageUrlInstance.searchParams.set('seqno', element.seqno);
                const link = removeUrlPageParam(nextPageUrlInstance.href);
                if (link === undefined) return;
                const dateString = `20${element.wdate}`;

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

            const page: number = +(urlInstance.searchParams.get('page') ?? 1);

            if (listData.length === 5) {
                const nextListUrlInstance = new URL(urlInstance.href);
                nextListUrlInstance.searchParams.set('page', (page + 1).toString());

                const nextList: string = nextListUrlInstance.href;
                this.log.info('Enqueueing list', { nextList });
                const nextListSiteData: SiteData = {
                    department: siteData.department,
                    isPinned: false,
                    isList: true,
                    dateString: '',
                };
                await this.addVaryingRequest(requestQueue, {
                    url: nextList,
                    userData: nextListSiteData,
                });
            }
        } else {
            throw new TypeError('listData is undefined');
        }
    };
}

export const chem = new ChemCrawler({
    departmentName: '화학부',
    departmentCode: 'chem',
    baseUrl: 'https://chem.snu.ac.kr/kor/newsnevent/',
    departmentCollege: SCIENCE,
    categoryTags: {
        'news_data.asp?code=001001': '공지사항',
        'jobs_data.asp?code=001004': '취업',
    },
});
