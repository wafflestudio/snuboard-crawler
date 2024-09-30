// filename must equal to first level of url domain.
// e.g. ir.snu.ac.kr -> ir.ts

import { URL } from 'url';

import { RequestQueue } from 'apify';
import { load } from 'cheerio';
import { CheerioCrawlingContext } from 'crawlee';

import { File, Notice } from '../../../server/src/notice/notice.entity.js';
import { CategoryCrawler } from '../../classes/categoryCrawler.js';
import { SOCIAL } from '../../constants.js';
import { strptime } from '../../micro-strptime.js';
import { SiteData } from '../../types/custom-types';
import { absoluteLink, departmentCode, getOrCreate, getOrCreateTagsWithMessage, saveNotice } from '../../utils.js';

class IRCrawler extends CategoryCrawler {
    override handlePage = async (context: CheerioCrawlingContext<SiteData, any>): Promise<void> => {
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
                $(element).attr('src', absoluteLink(imgSrc, this.baseUrl) ?? '');
            });

            const notice = await getOrCreate(Notice, { link: url }, false);

            notice.department = siteData.department;
            notice.departmentCode = departmentCode(siteData.department.name);

            notice.title = $('table.write-table th:contains("제목")').siblings('td').text().trim();
            const contentElement = $('table.write-table tr:nth-child(10)').children('td');
            const content =
                load(contentElement.html() ?? '', {
                    // @ts-ignore

                    decodeEntities: false,
                })('body').html() ?? '';
            // ^ encode non-unicode letters with utf-8 instead of HTML encoding
            notice.content = content;
            notice.contentText = contentElement.text().trim(); // texts are automatically utf-8 encoded
            notice.createdAt = strptime(siteData.dateString, '%Y-%m-%d');
            notice.isPinned = siteData.isPinned;
            notice.link = url;

            await saveNotice(notice);
            const fileBaseUrl = this.baseUrl.replace('korean/', 'download_file.php');
            const files: File[] = [];
            $('table.write-table th:contains("첨부")')
                .siblings('td')
                .find('button.ct-btn')
                .each((index, element) => {
                    const fileUrlRe = /go_download\('(.*)'\)/;
                    const fileUrl = $(element).attr('onclick')?.match(fileUrlRe);
                    if (fileUrl) {
                        const file = new File();

                        file.name = fileUrl[1].split('-')[1];
                        file.link = absoluteLink(`?file=${fileUrl[1]}`, fileBaseUrl) ?? '';
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
            let tags: string[] = [];
            const category: string = url.split('/')[4].substring(0, 16);

            tags.push(this.categoryTags[category.replace('_view', '')]);
            tags = tags.filter((tag) => tag !== this.excludedTag);
            await getOrCreateTagsWithMessage(tags, notice, siteData.department);
        }
    };

    override handleList = async (
        context: CheerioCrawlingContext<SiteData, any>,
        requestQueue: RequestQueue,
    ): Promise<void> => {
        const { request, $ } = context;
        const { url } = request;
        const siteData = <SiteData>request.userData;
        this.log.info('Page opened.', { url });

        if ($) {
            const urlInstance = new URL(url);
            const page: number = +(urlInstance.searchParams.get('pageNo') ?? 1);

            $('table.data-table tbody tr').each((index, element) => {
                const isPinned = $(element).find('i.fa-volume-up').length !== 0;
                const titleElement = $(element).children('td.title-td').children('a');
                if (request.loadedUrl === undefined) throw new TypeError('request.loadedUrl is undefined');
                let link = absoluteLink(titleElement.attr('href'), request.loadedUrl);
                if (link === undefined) return;
                const pageUrl = new URL(link);
                pageUrl.searchParams.delete('pageNo');
                link = pageUrl.href;

                const dateString = $(element).children('td:nth-child(3)').text().trim();
                const newSiteData: SiteData = {
                    department: siteData.department,
                    isPinned,
                    isList: false,
                    dateString,
                    commonUrl: siteData.commonUrl,
                };
                this.log.info('Enqueueing', { link });
                requestQueue.addRequest({
                    url: link,
                    userData: newSiteData,
                });
            });

            const lastNoticeId: string | undefined = $('table.data-table tbody tr')
                .last()
                .children('td')
                .first()
                .text()
                .trim();
            if (!lastNoticeId) return;

            if (Number.isNaN(+lastNoticeId) || +lastNoticeId > 1) {
                urlInstance.searchParams.set('pageNo', (page + 1).toString());

                const nextList: string = urlInstance.href;
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

export const ir = new IRCrawler({
    departmentName: '정치외교학부 외교학전공',
    departmentCode: 'ir',
    departmentCollege: SOCIAL,
    baseUrl: 'http://ir.snu.ac.kr/korean/',
    categoryTags: {
        'sub3_01.php': '학부공지',
        'sub3_03.php': '대학원공지',
        'sub3_06.php': '취업정보',
    },
});
