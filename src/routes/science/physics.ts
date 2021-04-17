import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { load } from 'cheerio';
import { RequestQueue } from 'apify';
import { Crawler } from '../../classes/crawler';
import { SCIENCE } from '../../constants';
import { SiteData } from '../../types/custom-types';
import { absoluteLink, getOrCreate, getOrCreateTags, saveNotice } from '../../utils';
import { File, Notice } from '../../../server/src/notice/notice.entity';
import { strptime } from '../../micro-strptime';

class PhysicsCrawler extends Crawler {
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
            notice.title = $('h1.bbstitle').text().trim();
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
                    file.link = request.loadedUrl;
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
        let minNoticeId = 1000;
        const urlInstance = new URL(request.loadedUrl);
        const page = +(urlInstance.searchParams.get('page') ?? 1);

        if ($ !== undefined) {
            $('table.fixwidth.table-rows tbody tr').each((index, element) => {
                const isPinned = $(element).find('td.text-center.noti-ico').length !== 0;

                const titleElement = $(element).find('td.title a').first();
                const link = absoluteLink(titleElement.attr('href'), request.loadedUrl);
                if (link === undefined) return;

                const dateString: string = $(element).find('td.text-center.hidden-xs-down').text();
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

            minNoticeId = Math.min(
                minNoticeId,
                +($('table.fixwidth.table-rows tbody tr').last().find('td.text-center').first().text() ?? -1),
            );

            if (minNoticeId > 1) {
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

export const physics = new PhysicsCrawler({
    departmentName: '물리천문학부',
    departmentCode: 'physics', // this value must be equal to the filename
    departmentCollege: SCIENCE,
    baseUrl: 'https://physics.snu.ac.kr/boards/notice',
});
