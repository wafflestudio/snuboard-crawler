import { CategoryCrawler } from '../../classes/categoryCrawler';
import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { SiteData } from '../../types/custom-types';
import { absoluteLink, getOrCreate, getOrCreateTags, saveNotice } from '../../utils';
import { File, Notice } from '../../../server/src/notice/notice.entity';
import { load } from 'cheerio';
import { strptime } from '../../micro-strptime';
import { URL } from 'url';
import { RequestQueue } from 'apify';
import { ENGINEERING, SCIENCE } from '../../constants';

class ChemCrawler extends CategoryCrawler {
    handlePage = async (context: CheerioHandlePageInputs): Promise<void> => {
        // const { request, $ } = context;
        // const { url } = request;
        // const siteData = <SiteData>request.userData;
        //
        // this.log.info('Page opened.', { url });
        // if ($ !== undefined) {
        //     // creation order
        //     // dept -> notice -> file
        //     //                -> tag -> notice_tag
        //     $('img').each((index, element) => {
        //         const imgSrc = $(element).attr('src');
        //         $(element).attr('src', absoluteLink(imgSrc, this.baseUrl) ?? '');
        //     });
        //     const notice = await getOrCreate(Notice, { link: url }, false);
        //
        //     notice.department = siteData.department;
        //     const title = $('div[property="dc:title"]').children('h2').text();
        //     notice.title = title;
        //     const contentElement = $('div[property="content:encoded"]');
        //
        //     const content = load(contentElement.html() ?? '', { decodeEntities: false })('body').html() ?? '';
        //     // ^ encode non-unicode letters with utf-8 instead of HTML encoding
        //     notice.content = content;
        //     notice.preview = contentElement.text().substring(0, 1000).trim(); // texts are automatically utf-8 encoded
        //     const fullDateString: string = $('div.field-name-post-date').find('div.field-item').text().trim();
        //
        //     try {
        //         notice.createdAt = strptime(fullDateString, '%Y-%m-%d %H:%M:%S');
        //     } catch {
        //         notice.createdAt = strptime(siteData.dateString, '%Y-%m-%d');
        //     }
        //
        //     notice.isPinned = siteData.isPinned;
        //     notice.link = url;
        //
        //     await saveNotice(notice);
        //
        //     const files: File[] = [];
        //     $('div.field-name-field-attachment')
        //         .find('span.file')
        //         .each((index, element) => {
        //             const fileUrl = $(element).children('a').attr('href');
        //             if (fileUrl) {
        //                 const file = new File();
        //                 file.name = $(element).children('a').text().trim();
        //                 file.link = fileUrl;
        //                 files.push(file);
        //             }
        //         });
        //     await Promise.all(
        //         // using Promise.all in order to ensure full execution
        //         files.map(async (file) => {
        //             file.notice = notice;
        //             await getOrCreate(File, file);
        //         }),
        //     );
        //
        //     const category = new URL(url).pathname.split('/')[3]; // url.replace(BaseUrl, '').split('?')[0];
        //     const tags = [this.categoryTags[category]];
        //     await getOrCreateTags(tags, notice, siteData.department);
        // } else {
        //     throw new TypeError('Selector is undefined');
        // }
    };

    handleList = async (context: CheerioHandlePageInputs, requestQueue: RequestQueue): Promise<void> => {
        const { request, response, $ } = context;
        const { url } = request;
        const siteData = <SiteData>request.userData;
        this.log.info('Page opened.', { url });

        if ($ !== undefined) {
            console.log(response);
            // $('tbody tr').each((index, element) => {
            //     const titleElement = $(element).children('td.views-field-title-field').children('a');
            //     const link = absoluteLink(titleElement.attr('href'), request.loadedUrl);
            //     if (link === undefined) return;
            //     const dateString = $(element).find('td.views-field-created').text().trim();
            //
            //     const newSiteData: SiteData = {
            //         department: siteData.department,
            //         isPinned: false,
            //         isList: false,
            //         dateString,
            //     };
            //     this.log.info('Enqueueing', { link });
            //     requestQueue.addRequest({
            //         url: link,
            //         userData: newSiteData,
            //     });
            // });
            //
            // const endElement = $('ul.pagination').children('li.pager-last').children('a').attr('href');
            // const endUrl = absoluteLink(endElement, request.loadedUrl);
            // if (!endUrl) return;
            // const endUrlInstance = new URL(endUrl);
            // const urlInstance = new URL(url);
            // const page: number = +(urlInstance.searchParams.get('page') ?? 1);
            // const endPage = endUrlInstance.searchParams.get('page');
            //
            // if (endPage && page < +endPage) {
            //     urlInstance.searchParams.set('page', (page + 1).toString());
            //
            //     const nextList: string = urlInstance.href;
            //     this.log.info('Enqueueing list', { nextList });
            //     const nextListSiteData: SiteData = {
            //         department: siteData.department,
            //         isPinned: false,
            //         isList: true,
            //         dateString: '',
            //     };
            //     await this.addVaryingRequest(requestQueue, {
            //         url: nextList,
            //         userData: nextListSiteData,
            //     });
            // }
        } else {
            throw new TypeError('Selector is undefined');
        }
    };
}

export const chem = new ChemCrawler({
    departmentName: '화학부',
    departmentCode: 'chehm',
    baseUrl: 'https://chem.snu.ac.kr/kor/newsnevent/',
    departmentCollege: SCIENCE,
    categoryTags: {
        'news_data.asp?code=001001&page=1': '공지사항',
        'jobs_data.asp?code=001004&page=1': '취업',
    },
});
