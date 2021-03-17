import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { load } from 'cheerio';
import { RequestQueue } from 'apify';
import { CategoryCrawler } from '../../classes/categoryCrawler';
import { SCIENCE } from '../../constants';
import { SiteData } from '../../types/custom-types';
import { absoluteLink, getOrCreate, getOrCreateTags, parseTitle, saveNotice } from '../../utils';
import { File, Notice } from '../../../server/src/notice/notice.entity';
import { strptime } from '../../micro-strptime';

class BiosciCrawler extends CategoryCrawler {
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
            notice.title = $('div[id="bbs-view-wrap"] h1.bbstitle').text().trim();
            const contentElement = $('div.bbs_contents');

            const content = load(contentElement.html() ?? '', { decodeEntities: false })('body').html() ?? '';
            // ^ encode non-unicode letters with utf-8 instead of HTML encoding
            notice.content = content;
            notice.preview = contentElement.text().substring(0, 1000).trim(); // texts are automatically utf-8 encoded
            const fullDateString: string = $('div.infowrap p.writer').text().split('l')[1].trim();
            // example: '2021-03-15'

            notice.createdAt = strptime(fullDateString, '%Y-%m-%d');
            notice.isPinned = siteData.isPinned;
            notice.link = url;

            await saveNotice(notice);

            const files: File[] = [];
            $('div.att-file ul li a').each((index, element) => {
                const fileUrl = $(element).attr('href');
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

            const tags: string[] = [];
            const urlInstance = new URL(request.loadedUrl);
            const category = urlInstance.searchParams.get('cidx');
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
            $('table.bbs-tblstyle tbody tr').each((index, element) => {
                const titleElement = $(element).find('td.title a');
                const isPinned = $(element).children('td').first().text().trim() === '공지';

                let link = absoluteLink(titleElement.attr('href'), request.loadedUrl);
                if (link === undefined) return;
                const pageUrl = new URL(link);
                pageUrl.searchParams.delete('page');
                link = pageUrl.href;
                const newSiteData: SiteData = {
                    department: siteData.department,
                    isPinned,
                    isList: false,
                    dateString: '',
                };
                this.log.info('Enqueueing', { link });
                requestQueue.addRequest({
                    url: link,
                    userData: newSiteData,
                });
            });

            const urlInstance = new URL(url);
            const page: number = +(urlInstance.searchParams.get('page') ?? 1);

            const lastNoticeId: string | undefined = $('table.bbs-tblstyle tbody tr')
                .last()
                .children('td')
                .first()
                .text()
                .trim();
            if (!lastNoticeId) return;
            if (Number.isNaN(+lastNoticeId) || +lastNoticeId > 1) {
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

export const biosci = new BiosciCrawler({
    departmentName: '생명과학부',
    departmentCode: 'biosci', // this value must be equal to the filename
    departmentCollege: SCIENCE,
    baseUrl: 'https://biosci.snu.ac.kr/board/notice?cidx=',
    categoryTags: {
        // 0: '전체분류',
        15: '입시',
        29: '학부공지',
        30: '대학원공지',
        31: '학부/대학원',
        32: '논문/졸업',
        33: '과제공고',
        34: '기타',
    },
});
