import { load } from 'cheerio';
import { RequestQueue } from 'apify';
import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { URL } from 'url';
import { HUMANITIES, INF } from '../../constants';
import { Crawler } from '../../classes/crawler';
import { SiteData } from '../../types/custom-types';
import {
    absoluteLink,
    departmentCode,
    getOrCreate,
    getOrCreateTagsWithMessage,
    parseTitle,
    saveNotice,
} from '../../utils';
import { File, Notice } from '../../../server/src/notice/notice.entity';
import { strptime } from '../../micro-strptime';

class SnuFranceCrawler extends Crawler {
    handlePage = async (context: CheerioHandlePageInputs): Promise<void> => {
        const { request, $ } = context;
        const { url } = request;
        const siteData = <SiteData>request.userData;

        this.log.info('Page opened.', { url });

        if ($) {
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
            notice.departmentCode = departmentCode(siteData.department.name);

            // find category in stat.snu.ac.kr & geog.snu.ac.kr
            notice.title = $('div.title').text().trim();

            const contentElement = $('div.bbsCONTENTS2');
            const content = load(contentElement.html() ?? '', { decodeEntities: false })('body').html() ?? '';
            // ^ encode non-unicode letters with utf-8 instead of HTML encoding
            notice.content = content;
            notice.contentText = contentElement.text().trim(); // texts are automatically utf-8 encoded
            const fullDateString = $('div.ri_box dl dd').text().trim();
            notice.createdAt = strptime(fullDateString, '%Y-%m-%d %p %H:%M:%S');
            notice.isPinned = siteData.isPinned;
            notice.link = url;
            await saveNotice(notice);

            const files: File[] = [];
            $('div.le_box dl dd a').each((index, element) => {
                let fileParams = $(element)
                    .attr('onclick')
                    ?.match(/'[^']+'/g);
                if (fileParams === null || fileParams === undefined) return;
                fileParams = fileParams.map((param) => {
                    return param.slice(1, -1);
                });
                const fileUrlInstance = new URL('http://www.snufrance.com/__admopt/__class/__download.asp');
                fileUrlInstance.searchParams.set('pathUrl', fileParams[0]);
                fileUrlInstance.searchParams.set('filename', fileParams[1]);
                fileUrlInstance.searchParams.set('realname', fileParams[2]);
                const file = new File();
                // eslint-disable-next-line prefer-destructuring
                file.name = $(element).text().trim();
                file.link = fileUrlInstance.href;
                files.push(file);
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
        }
    };

    handleList = async (context: CheerioHandlePageInputs, requestQueue: RequestQueue): Promise<void> => {
        const { request, $ } = context;
        const { url } = request;
        const siteData = <SiteData>request.userData;
        this.log.info('Page opened.', { url });
        const urlInstance = new URL(url);
        const page = +(urlInstance.searchParams.get('curpage') ?? '1');

        if ($) {
            $('table.bbsL tbody tr').each((index, element) => {
                const titleElement = $(element).find('td:nth-child(2) a');
                const idx = titleElement.attr('onclick')?.replace(/[^0-9]/g, '');
                if (idx === undefined) return;
                const nextUrl = new URL(request.loadedUrl);
                if (nextUrl === undefined) return;
                nextUrl.searchParams.set('mode', 'view');
                nextUrl.searchParams.delete('curpage');
                nextUrl.searchParams.set('idx', idx);
                const dateString = $(element).find('td:nth-child(3)').text().trim();
                const link = nextUrl.href;
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

            const lastPageString = $('a.wcyr_next_e')
                .attr('onclick')
                ?.replace(/[^0-9]/g, '');
            if (lastPageString === undefined) return;

            if (page < +lastPageString) {
                const nextListUrlInstance = new URL(url);
                nextListUrlInstance.searchParams.set('curpage', `${page + 1}`);

                const nextList: string = nextListUrlInstance.href;
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
        }
    };
}

export const snuFrance = new SnuFranceCrawler({
    departmentName: '불어불문학과',
    departmentCode: 'snufrance',
    departmentCollege: HUMANITIES,
    departmentLink: 'http://snufrance.com/home/main/index.asp',
    baseUrl:
        'http://www.snufrance.com/home/opsquare/notice.asp?gubun=SNUFR&board_cd=NOTICE&strOpt=&searchField=&searchWord=&curpage=1',
});
