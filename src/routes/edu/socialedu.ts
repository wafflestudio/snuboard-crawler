import { RequestQueue } from 'apify';
import { load } from 'cheerio';
import { CheerioCrawlingContext } from 'crawlee';

import { File, Notice } from '../../../server/src/notice/notice.entity.js';
import { CategoryCrawler } from '../../classes/categoryCrawler.js';
import { Crawler } from '../../classes/crawler.js';
import { EDU, INF } from '../../constants.js';
import { strptime } from '../../micro-strptime.js';
import { SiteData } from '../../types/custom-types';
import {
    absoluteLink,
    departmentCode,
    getOrCreate,
    getOrCreateTagsWithMessage,
    removeUrlPageParam,
    saveNotice,
} from '../../utils.js';

export class SocialEduCrawler extends CategoryCrawler {
    protected override readonly encoding: string = 'EUC-KR';

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
                if (imgSrc) {
                    $(element).attr('src', absoluteLink(imgSrc, this.baseUrl) ?? '');
                }
            });
            const notice = await getOrCreate(Notice, { link: url }, false);

            notice.department = siteData.department;
            notice.departmentCode = departmentCode(siteData.department.name);
            notice.title = $('span.bbs_subject_css').text().trim();
            const contentElement = $('div.bbs_view_middle');
            let content = contentElement.html() ?? '';
            content =
                load(content, {
                    // @ts-ignore

                    decodeEntities: false,
                })('body')
                    .html()
                    ?.trim() ?? '';
            // ^ encode non-unicode letters with utf-8 instead of HTML encoding
            notice.content = content;
            notice.contentText = contentElement.text().trim(); // texts are automatically utf-8 encoded
            const fullDateString: string = siteData.dateString;
            // example: '2021-02-26'
            notice.createdAt = strptime(fullDateString, '%Y-%m-%d');

            notice.isPinned = siteData.isPinned;

            notice.link = url;

            await saveNotice(notice);

            const files: File[] = [];
            $('span.txt05 a').each((index, element) => {
                const fileUrl = $(element).attr('href');
                if (fileUrl) {
                    const file = new File();
                    file.name = $(element).text().trim();
                    file.link = notice.link;
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
            const tags: string[] = [this.categoryTags[siteData.tag ?? ''] ?? '공지사항'];

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
        let lastNoticeId = INF;
        this.log.info('Page opened.', { url });
        if ($ !== undefined) {
            const urlInstance = new URL(url);
            const pageString = urlInstance.searchParams.get('page') ?? '1';
            const page: number = +pageString;

            $('div.bbs_list_css').each((index, element) => {
                const noticeNum = $(element).find('tr td:nth-child(1)').text().trim();
                const isPinned = noticeNum === '';

                if (!isPinned) {
                    lastNoticeId = Math.min(lastNoticeId, +noticeNum);
                }

                const titleElement = $(element).find('tr td:nth-child(2) a');
                // const title = titleElement.text();

                if (request.loadedUrl === undefined) throw new TypeError('request.loadedUrl is undefined');
                const link = removeUrlPageParam(absoluteLink(titleElement.attr('href'), request.loadedUrl));
                if (link === undefined) return;

                const dateString = $(element).find('tr td:nth-child(4)').text().trim();

                const newSiteData: SiteData = {
                    department: siteData.department,
                    isPinned,
                    isList: false,
                    dateString,
                    commonUrl: siteData.commonUrl,
                    tag: siteData.tag,
                };
                this.log.info('Enqueueing', { link });
                requestQueue.addRequest({
                    url: link,
                    userData: newSiteData,
                });
            });

            const nextListUrlInstance = new URL(url);
            nextListUrlInstance.searchParams.set('page', `${page + 1}`);
            const nextList = nextListUrlInstance.href;
            // lastNoticeId === 1  <==> loaded page is the last page
            if (lastNoticeId > 1) {
                this.log.info('Enqueueing list', { nextList });
                const nextListSiteData: SiteData = {
                    department: siteData.department,
                    isPinned: false,
                    isList: true,
                    dateString: '',
                    commonUrl: siteData.commonUrl,
                    tag: siteData.tag,
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

export const socialEdu = new SocialEduCrawler({
    departmentName: '사회교육과',
    departmentCode: 'socialedu', // this value must be equal to the filename
    departmentCollege: EDU,
    baseUrl: 'https://socialedu.snu.ac.kr/sub6/6_1.php?page=1&b_name=notice',
    categoryTags: {
        notice: '공지사항',
    },
});
