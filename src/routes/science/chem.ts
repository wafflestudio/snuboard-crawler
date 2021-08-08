import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { load } from 'cheerio';
import { URL } from 'url';
import { RequestQueue } from 'apify';
import { CategoryCrawler } from '../../classes/categoryCrawler';
import { SiteData } from '../../types/custom-types';
import { absoluteLink, getOrCreate, getOrCreateTagsWithMessage, saveNotice } from '../../utils';
import { File, Notice } from '../../../server/src/notice/notice.entity';
import { strptime } from '../../micro-strptime';
import { INF, SCIENCE } from '../../constants';

class ChemCrawler extends CategoryCrawler {
    //    protected readonly encoding: string = 'EUC-KR';

    //    protected readonly maxRetries: number = 5;

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
            let title = $('h1.bbstitle').text().trim().slice(0, 255);
            if (siteData.tag) {
                title = title.substr(title.indexOf(']') + 1).trim();
            }
            notice.title = title;
            const contentElement = $('div.fixwidth.bbs_contents');

            let content = contentElement.html() ?? '';
            content = load(content, { decodeEntities: false })('body').html() ?? '';
            // ^ encode non-unicode letters with utf-8 instead of HTML encoding
            notice.content = content;
            notice.contentText = contentElement.text().trim(); // texts are automatically utf-8 encoded
            // example: '2021-02-26 11:34:01'
            notice.createdAt = strptime(siteData.dateString, '%Y-%m-%d');

            notice.isPinned = siteData.isPinned;
            notice.link = url;

            await saveNotice(notice);

            const files: File[] = [];
            $('ul.board-filelist div a').each((index, element) => {
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
            if (siteData.tag) {
                tags.push(siteData.tag);
            }
            const cate = url.split('/')[4].split('?')[0];
            tags.push(this.categoryTags[cate]);

            await getOrCreateTagsWithMessage(tags, notice, siteData.department);
        } else {
            throw new TypeError('Selector is undefined');
        }
    };

    handleList = async (context: CheerioHandlePageInputs, requestQueue: RequestQueue): Promise<void> => {
        const { request, $ } = context;
        const { url } = request;
        const siteData = <SiteData>request.userData;
        this.log.info('Page opened.', { url });
        const urlInstance = new URL(request.loadedUrl);
        const page = +(urlInstance.searchParams.get('page') ?? 1);

        if ($ !== undefined) {
            $('table.fixwidth.table-rows tbody tr').each((index, element) => {
                const titleElement = $(element).find('td.title a');
                const link = absoluteLink(titleElement.attr('href'), request.loadedUrl);
                if (link === undefined) return;
                const tag: string = $(element).find('td.text-center:nth-child(2)').text();
                const dateString: string = $(element).find('td.text-center.hidden-xs-down').last().text();
                const newSiteData: SiteData = {
                    department: siteData.department,
                    isPinned: false,
                    isList: false,
                    dateString,
                    commonUrl: siteData.commonUrl,
                    tag,
                };
                this.log.info('Enqueueing', { link });
                requestQueue.addRequest({
                    url: link,
                    userData: newSiteData,
                });
            });

            let lastNoticeId = +$('table.fixwidth.table-rows tbody tr')
                .last()
                .find('td.text-center')
                .first()
                .text()
                .trim();
            if (Number.isNaN(lastNoticeId)) {
                lastNoticeId = INF;
            }

            if (lastNoticeId > 1) {
                const nextUrlInstance = new URL(urlInstance.href);
                nextUrlInstance.searchParams.set('page', (page + 1).toString());
                const nextList = nextUrlInstance.href;
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

export const chem = new ChemCrawler({
    departmentName: '화학부',
    departmentCode: 'chem',
    baseUrl: 'https://chem.snu.ac.kr/community/',
    departmentCollege: SCIENCE,
    categoryTags: {
        notice: '공지사항',
        recruit: '취업',
    },
});
