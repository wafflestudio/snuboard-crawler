import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { load } from 'cheerio';
import { RequestQueue } from 'apify';
import { SCIENCE } from '../../constants';
import { SiteData } from '../../types/custom-types';
import { absoluteLink, getOrCreate, getOrCreateTags, saveNotice } from '../../utils';
import { File, Notice } from '../../../server/src/notice/notice.entity';
import { strptime } from '../../micro-strptime';
import { Crawler } from '../../classes/crawler';

export class BiosciCrawler extends Crawler {
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
            const tagTitle = $('h1.bbstitle').text().trim();
            notice.title = tagTitle.startsWith('[') ? tagTitle.substring(tagTitle.indexOf(']') + 1).trim() : tagTitle;

            const contentElement = $('div.bbs_contents');

            const content = load(contentElement.html() ?? '', { decodeEntities: false })('body').html() ?? '';
            // ^ encode non-unicode letters with utf-8 instead of HTML encoding
            notice.content = content;
            notice.preview = contentElement.text().substring(0, 1000).trim(); // texts are automatically utf-8 encoded

            notice.createdAt = strptime(siteData.dateString, '%Y-%m-%d');
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
            if (siteData.tag !== undefined) {
                tags.push(siteData.tag);
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
            $('table.fixwidth tbody tr').each((index, element) => {
                const titleElement = $(element).find('td.title a');
                const isPinned = $(element).hasClass('noti');

                let link = absoluteLink(titleElement.attr('href'), request.loadedUrl);
                if (link === undefined) return;
                const pageUrl = new URL(link);
                pageUrl.searchParams.delete('page');
                link = pageUrl.href;
                const tagElement = $(element).find('td:nth-child(2)');
                let tag: string;
                // to use biosci Crawler in cals
                if (tagElement.hasClass('hidden-sm-down')) {
                    tag = tagElement.text() === '' ? '미분류' : tagElement.text();
                } else tag = '공지사항';
                const dateString = $(element).find('td:nth-last-child(2)').text();

                const newSiteData: SiteData = {
                    department: siteData.department,
                    isPinned,
                    isList: false,
                    dateString,
                    tag,
                };
                this.log.info('Enqueueing', { link });
                requestQueue.addRequest({
                    url: link,
                    userData: newSiteData,
                });
            });

            const nextList = absoluteLink($('.pagination-01 ul.pager li.next a').attr('href'), url);
            if (nextList === url || nextList === undefined) return;

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
        } else {
            throw new TypeError('Selector is undefined');
        }
    };
}

export const biosci = new BiosciCrawler({
    departmentName: '생명과학부',
    departmentCode: 'biosci', // this value must be equal to the filename
    departmentCollege: SCIENCE,
    baseUrl: 'https://biosci.snu.ac.kr/board/notice',
});
