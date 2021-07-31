import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { load } from 'cheerio';
import { RequestQueue } from 'apify';
import { Crawler } from '../../classes/crawler';
import { HUMANITIES, INF } from '../../constants';
import { SiteData } from '../../types/custom-types';
import { absoluteLink, getOrCreate, getOrCreateTagsWithMessage, removeUrlPageParam, saveNotice } from '../../utils';
import { File, Notice } from '../../../server/src/notice/notice.entity';
import { strptime } from '../../micro-strptime';

class ArchaeologyArtHistoryCrawler extends Crawler {
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
                if (imgSrc && !imgSrc.startsWith('data')) {
                    $(element).attr('src', absoluteLink(imgSrc, this.baseUrl) ?? '');
                }
            });
            const notice = await getOrCreate(Notice, { link: url }, false);

            notice.department = siteData.department;
            const noticeElement = $('table.noticeView tbody tr');
            notice.title = noticeElement.find('tr:nth-child(1) th').text().trim();
            const contentElement = noticeElement.find('td.viewTxt');
            let content = contentElement.html() ?? '';
            content = load(content, { decodeEntities: false })('body').html()?.trim() ?? '';
            // ^ encode non-unicode letters with utf-8 instead of HTML encoding
            notice.content = content;
            notice.contentText = contentElement.text().trim(); // texts are automatically utf-8 encoded
            notice.createdAt = strptime(siteData.dateString, '%Y-%m-%d');

            notice.isPinned = siteData.isPinned;

            notice.link = url;

            await saveNotice(notice);

            const files: File[] = [];
            noticeElement.find('tr:nth-child(2) td a').each((index, element) => {
                const fileUrl = $(element).attr('href');
                if (fileUrl) {
                    const file = new File();
                    file.name = $(element).text().trim();
                    file.link = absoluteLink(fileUrl, this.baseUrl) ?? notice.link;
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
            const tags: string[] = ['공지사항'];

            await getOrCreateTagsWithMessage(tags, notice, siteData.department);
        } else {
            throw new TypeError('Selector is undefined');
        }
    };

    handleList = async (context: CheerioHandlePageInputs, requestQueue: RequestQueue): Promise<void> => {
        const { request, $ } = context;
        const { url } = request;
        const siteData = <SiteData>request.userData;
        let lastNoticeId = INF;
        this.log.info('Page opened.', { url });
        if ($ !== undefined) {
            const urlInstance = new URL(url);
            const page: number = +(urlInstance.searchParams.get('cur_page') ?? '1');

            $('table.partNotice tbody tr').each((index, element) => {
                const titleElement = $(element).find('td.td2dep a');
                // const title = titleElement.text();
                lastNoticeId = Math.min(lastNoticeId, +($(element).find('td:nth-child(1)').text().trim() ?? `${INF}`));
                const nextLink = absoluteLink(titleElement.attr('href'), this.baseUrl);
                if (nextLink === undefined) return;
                const LinkUrlInstance = new URL(nextLink);

                LinkUrlInstance.searchParams.delete('cur_page');
                const link = LinkUrlInstance.href;
                const dateString = $($(element).children('td')[2]).text().trim();

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

            const nextListUrlInstance = new URL(url);
            nextListUrlInstance.searchParams.set('cur_page', `${page + 1}`);
            const nextList = nextListUrlInstance.href;
            // +lastNoticeId === 1  <==> loaded page is the last page
            if (+lastNoticeId > 1) {
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

export const archaeologyArthistory = new ArchaeologyArtHistoryCrawler({
    departmentName: '고고미술사학과',
    departmentCode: 'archaeology-arthistory', // this value must be equal to the filename
    departmentCollege: HUMANITIES,
    baseUrl: 'http://www.archaeology-arthistory.or.kr/?c=user&mcd=sad0001&cur_page=1',
    departmentLink: 'archaeology-arthistory.or.kr',
});
