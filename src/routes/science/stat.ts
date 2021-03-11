import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { load } from 'cheerio';
import { RequestQueue } from 'apify';
import { URL } from 'url';
import { Crawler } from '../../classes/crawler';
import { SiteData } from '../../types/custom-types';
import { absoluteLink, getOrCreate, getOrCreateTags, removeUrlPageParam, saveNotice } from '../../utils';
import { File, Notice } from '../../../server/src/notice/notice.entity';
import { strptime } from '../../micro-strptime';
import { SCIENCE } from '../../constants';

class StatCrawler extends Crawler {
    handlePage = async (context: CheerioHandlePageInputs): Promise<void> => {
        const { request, $ } = context;
        const { url } = request;
        const siteData = <SiteData>request.userData;

        this.log.info('Page opened.', { url });
        if ($) {
            // creation order
            // dept -> notice -> file
            //                -> tag -> notice_tag

            const notice = await getOrCreate(Notice, { link: url }, false);
            const td = $($('div#right_content').children()[2]).find('tr td.board_item');

            const tagTitle = td.first().text();
            notice.department = siteData.department;
            notice.title = tagTitle.substring(tagTitle.indexOf(']') + 1).trim();

            const contentElement = $(td[2]);
            let content = contentElement.html() ?? '';
            content = load(content, { decodeEntities: false })('body').html() ?? '';
            // ^ encode non-unicode letters with utf-8 instead of HTML encoding
            notice.content = content;
            notice.preview = contentElement.text().substring(0, 1000).trim(); // texts are automatically utf-8 encoded

            try {
                // example: '2021/02/15 (월) 오후 7:21'
                const fullDateString: string = $(td[1]).text().trim();
                notice.createdAt = strptime(fullDateString, '%Y-%m-%d %H:%M:%S');
            } catch (error) {
                if (error instanceof TypeError) {
                    notice.createdAt = strptime(siteData.dateString, '%Y.%m.%d');
                } else {
                    throw error;
                }
            }

            notice.isPinned = siteData.isPinned;

            notice.link = url;

            // author: $('span.username').text().trim()

            await saveNotice(notice);

            const files: File[] = [];
            $(td[3])
                .children('a')
                .each(function (index, element) {
                    if ($(element).attr('target') === '_blank') return;
                    const fileUrl = $(element).attr('href');
                    if (fileUrl) {
                        const file = new File();
                        file.name = $(element).text().trim();
                        file.link = absoluteLink(fileUrl, request.loadedUrl) ?? '';
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

            const tags = [tagTitle.substring(1, tagTitle.indexOf(']'))];
            await getOrCreateTags(tags, notice, siteData.department);
        }
    };

    handleList = async (context: CheerioHandlePageInputs, requestQueue: RequestQueue): Promise<void> => {
        const { request, $ } = context;
        const { url } = request;
        const siteData = <SiteData>request.userData;
        this.log.info('Page opened.', { url });
        let minNoticeId = 1000;

        const urlInstance = new URL(url);
        const page = +(urlInstance.searchParams.get('cpage') ?? 1);
        if ($) {
            $('table tr').each((index, element) => {
                const td = $(element).children('td.board_item');
                if (!td.length) return;

                const noticeId = td.first().text().replace(',', '');
                const isPinned = noticeId === 'NOTICE';
                if (page > 1 && isPinned) return;

                if (!isPinned) {
                    minNoticeId = Math.min(minNoticeId, +noticeId);
                }

                const titleElement = $(td[2]).find('a').first();
                // const title = titleElement.text();
                let link = absoluteLink(titleElement.attr('href'), this.baseUrl);

                if (link === undefined) return;
                const pageUrl = new URL(link);

                pageUrl.searchParams.delete('cpage');
                link = pageUrl.href;

                const dateString = $(td[3]).text().trim();

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

            if (minNoticeId > 1) {
                const nextUrlInstance = new URL(urlInstance.href);
                nextUrlInstance.searchParams.set('cpage', (page + 1).toString());
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
        }
    };
}

export const stat = new StatCrawler({
    departmentName: '통계학과',
    departmentCode: 'stat', // this value must be equal to the filename
    departmentCollege: SCIENCE,
    baseUrl: 'https://stat.snu.ac.kr/board.php',
});
