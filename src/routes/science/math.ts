import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { load } from 'cheerio';
import { RequestQueue } from 'apify';
import { CategoryCrawler } from '../../classes/categoryCrawler';
import { SCIENCE } from '../../constants';
import { SiteData } from '../../types/custom-types';
import { absoluteLink, getOrCreate, getOrCreateTags, saveNotice } from '../../utils';
import { File, Notice } from '../../../server/src/notice/notice.entity';
import { strptime } from '../../micro-strptime';

class MathCrawler extends CategoryCrawler {
    handlePage = async (context: CheerioHandlePageInputs): Promise<void> => {
        const { request, $ } = context;
        const { url } = request;
        const siteData = <SiteData>request.userData;

        this.log.info('Page opened.', { url });

        if ($ !== undefined) {
            // creation order
            // dept -> notice -> file
            //                -> tag -> notice_tag

            const notice = await getOrCreate(Notice, { link: url }, false);

            notice.department = siteData.department;
            notice.title = $('div.titleAndUser div.title h2 a, div.titleAndUser div.title h1 a ').text().trim();
            const contentElement = $('div.contentBody div.xe_content');
            let content;
            if ($('div.contentBody div.xe_content div.document_popup_menu').length) {
                contentElement.find('div.document_popup_menu').remove();
                content = contentElement.html() ?? '';
            } else {
                content = contentElement.html() ?? '';
            }
            content = load(content, { decodeEntities: false })('body').html() ?? '';
            // ^ encode non-unicode letters with utf-8 instead of HTML encoding
            notice.content = content;
            notice.preview = contentElement.text().substring(0, 1000).trim(); // texts are automatically utf-8 encoded
            const fullDateString: string = $('div.dateAndCount div.date').text().trim();
            // example: '2021-02-26 11:34:01'
            notice.createdAt = strptime(fullDateString, '%Y.%m.%d %H:%M:%S');

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

            const tags: string[] = [];
            const urlInstance = new URL(request.loadedUrl);
            const category = urlInstance.searchParams.get('mid');
            if (category && this.categoryTags[category]) {
                tags.push(this.categoryTags[category]);
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
            $('table.boardList tbody tr').each((index, element) => {
                const titleElement = $(element).find('td.title a').first();
                // const title = titleElement.text();

                let link = absoluteLink(titleElement.attr('href'), request.loadedUrl);
                if (link === undefined) return;
                const pageUrl = new URL(link);
                pageUrl.searchParams.delete('page');
                link = pageUrl.href;

                const newSiteData: SiteData = {
                    department: siteData.department,
                    isPinned: false,
                    isList: false,
                    dateString: '',
                };
                this.log.info('Enqueueing', { link });
                requestQueue.addRequest({
                    url: link,
                    userData: newSiteData,
                });
            });

            const endElement = $('div.pagination.a1 a.nextEnd');
            const endUrl = absoluteLink(endElement.attr('href'), request.loadedUrl);
            const endUrlInstance = new URL(endUrl ?? '');
            const urlInstance = new URL(request.loadedUrl);

            const endPage = +(endUrlInstance.searchParams.get('page') ?? 1);
            const page = +(urlInstance.searchParams.get('page') ?? 1);

            if (page < endPage) {
                const nextUrlInstance = new URL(urlInstance.href);
                nextUrlInstance.searchParams.set('page', (page + 1).toString());
                const nextList = nextUrlInstance.href;

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
            throw new TypeError('Selector is undefined');
        }
    };
}

export const math = new MathCrawler({
    departmentName: '수리과학부',
    departmentCode: 'math', // this value must be equal to the filename
    departmentCollege: SCIENCE,
    baseUrl: 'http://www.math.snu.ac.kr/board/index.php?mid=',
    categoryTags: {
        notice: '공지사항',
        employment: '행사/취업',
    },
});
