import { URL } from 'url';

import { RequestQueue } from 'apify';
import { load } from 'cheerio';
import { CheerioCrawlingContext } from 'crawlee';

import { Notice, File } from '../../../server/src/notice/notice.entity.js';
import { CategoryCrawler } from '../../classes/categoryCrawler.js';
import { HUMANITIES } from '../../constants.js';
import { strptime } from '../../micro-strptime.js';
import { SiteData } from '../../types/custom-types';
import { absoluteLink, departmentCode, getOrCreate, getOrCreateTagsWithMessage, saveNotice } from '../../utils.js';

class AsiaCrawler extends CategoryCrawler {
    override handlePage = async (context: CheerioCrawlingContext<SiteData, any>): Promise<void> => {
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
            notice.departmentCode = departmentCode(siteData.department.name);
            const title = $('div.board_total header h1#bo_v_title').text().trim();
            notice.title = title.substring(title.indexOf('|') + 1).trim();

            const tags: string[] = [];
            tags.push(title.substring(0, title.indexOf('|')).trim());
            const fileElement = $('section#bo_v_file li');

            const contentElement = $('section#bo_v_atc');
            contentElement.find('h2#bo_v_atc_title').remove();

            const content =
                load(contentElement.html() ?? '', {
                    // @ts-ignore

                    decodeEntities: false,
                })('body').html() ?? '';
            // ^ encode non-unicode letters with utf-8 instead of HTML encoding
            notice.content = content;
            notice.contentText = contentElement.text().trim(); // texts are automatically utf-8 encoded
            const dateString = $('section#bo_v_info strong:nth-child(4)').text();
            notice.createdAt = strptime(`20${dateString}`, '%Y-%m-%d %H:%M');
            notice.isPinned = siteData.isPinned;
            notice.link = url;

            await saveNotice(notice);

            const files: File[] = [];
            fileElement.each((index, element) => {
                const fileInstance = $(element).children('a');
                if (fileInstance) {
                    const file = new File();
                    file.name = fileInstance.find('strong').text().trim();
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

            if (siteData.tag !== undefined) {
                tags.push(this.categoryTags[siteData.tag] ?? '공지사항');
            }
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
        const urlInstance = new URL(url, this.baseUrl);
        this.log.info('Page opened.', { url });

        if ($ !== undefined) {
            $('div.tbl_head01 tbody tr').each((index, element) => {
                const titleElement = $(element).find('td.td_subject');
                let link = absoluteLink(titleElement.children('a').attr('href'), url);
                if (link === undefined) return;
                const pageUrl = new URL(link);
                pageUrl.searchParams.delete('page');
                link = pageUrl.href;
                // const dateString = $(element).find('td.td_date').text().trim();

                const newSiteData: SiteData = {
                    department: siteData.department,
                    isPinned: false,
                    isList: false,
                    dateString: '',
                    commonUrl: siteData.commonUrl,
                    tag: siteData.tag,
                };
                this.log.info('Enqueueing', { link });
                requestQueue.addRequest({
                    url: link,
                    userData: newSiteData,
                });
            });

            const lastElement = $('a.pg_end');
            const page = urlInstance.searchParams.get('page') ?? '1';
            if (lastElement.length === 0) return;
            const nextUrl = urlInstance;
            nextUrl.searchParams.set('page', `${+page + 1}`);
            const nextList = nextUrl.href;
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
        } else {
            throw new TypeError('Selector is undefined');
        }
    };
}

export const asia = new AsiaCrawler({
    departmentName: '아시아언어문명학부',
    departmentCode: 'asia',
    baseUrl: 'https://asia.snu.ac.kr/bbs/board.php?bo_table=',
    departmentCollege: HUMANITIES,
    categoryTags: {
        51: '공지사항',
        52: '학부행사',
    },
});
