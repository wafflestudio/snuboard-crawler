import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { load } from 'cheerio';
import { RequestQueue } from 'apify';
import { Crawler } from '../../classes/crawler';
import { CBA } from '../../constants';
import { SiteData } from '../../types/custom-types';
import { absoluteLink, getOrCreate, getOrCreateTags, removeUrlPageParam, saveNotice } from '../../utils';
import { File, Notice } from '../../../server/src/notice/notice.entity';
import { strptime } from '../../micro-strptime';

class CbaCrawler extends Crawler {
    protected readonly encoding: string = 'EUC-KR';

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
            notice.title = $('p.bbstit').text().trim();
            const contentElement = $('div.CBA_innercontent');
            let content = contentElement.html() ?? '';
            content = load(content, { decodeEntities: false })('body').html() ?? '';
            // ^ encode non-unicode letters with utf-8 instead of HTML encoding
            notice.content = content;
            notice.contentText = contentElement.text().trim(); // texts are automatically utf-8 encoded

            try {
                const fullDateString: string = $('table tbody tr:nth-child(2) td:nth-child(2)').text().trim();
                notice.createdAt = strptime(fullDateString, '%Y-%m-%d %H:%M:%S');
            } catch {
                notice.createdAt = strptime(siteData.dateString, '%Y-%m-%d');
            }

            notice.isPinned = siteData.isPinned;
            notice.link = url;

            await saveNotice(notice);

            const files: File[] = [];
            $('td.afile ul li a').each((index, element) => {
                const fileUrl = $(element).attr('href');
                if (fileUrl) {
                    const file = new File();
                    file.name = $(element).text().trim();
                    file.link = absoluteLink(fileUrl, url) ?? '';
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

            const tags: string[] = [];
            const categoryString = $('.cate').text();
            const category = categoryString.substring(1, categoryString.length - 1);
            tags.push(category);
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
        const urlInstance = new URL(url);
        const page: number = +(urlInstance.searchParams.get('page') ?? 1);
        if ($ !== undefined) {
            $('table tbody tr').each((index, element) => {
                const isPinned = $(element).children('td.notice').length !== 0;

                const titleElement = $(element).find('td.title a');
                // const title = titleElement.text();
                const link = removeUrlPageParam(absoluteLink(titleElement.attr('href'), request.loadedUrl));
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

            const nextPage = +(
                new URL(absoluteLink($('div.bbspage a.next').attr('href'), request.loadedUrl) ?? '').searchParams.get(
                    'page',
                ) ?? 1
            );

            if (page !== nextPage) {
                const nextListInstance = new URL(urlInstance.href);
                nextListInstance.searchParams.set('page', (page + 1).toString());

                this.log.info('Enqueueing list', { nextList: nextListInstance.href });

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
        } else {
            throw new TypeError('Selector is undefined');
        }
    };
}

export const cba = new CbaCrawler({
    departmentName: '경영대학',
    departmentCode: 'cba', // this value must be equal to the filename
    departmentCollege: CBA,
    baseUrl: 'https://cba.snu.ac.kr/ko/notice',
});
