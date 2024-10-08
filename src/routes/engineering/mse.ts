// filename must equal to first level of url domain.
// e.g. mse.snu.ac.kr -> mse.ts

import { URL } from 'url';

import { RequestQueue } from 'apify';
import { load } from 'cheerio';
import { CheerioCrawlingContext } from 'crawlee';

import { Notice, File } from '../../../server/src/notice/notice.entity.js';
import { CategoryCrawler } from '../../classes/categoryCrawler.js';
import { ENGINEERING } from '../../constants.js';
import { strptime } from '../../micro-strptime.js';
import { CategoryTag, SiteData } from '../../types/custom-types';
import { absoluteLink, departmentCode, getOrCreate, getOrCreateTagsWithMessage, saveNotice } from '../../utils.js';

class MSECrawler extends CategoryCrawler {
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
                if (imgSrc && !imgSrc.startsWith('data')) {
                    $(element).attr('src', absoluteLink(imgSrc, this.baseUrl) ?? '');
                }
            });

            const notice = await getOrCreate(Notice, { link: url }, false);

            notice.department = siteData.department;
            notice.departmentCode = departmentCode(siteData.department.name);
            const title = $('div.g_head div.title').text().trim();
            notice.title = title;
            const contentElement = $('div.g_body');
            const content =
                load(contentElement.html() ?? '', {
                    // @ts-ignore

                    decodeEntities: false,
                })('body').html() ?? '';
            // ^ encode non-unicode letters with utf-8 instead of HTML encoding
            notice.content = content;
            notice.contentText = contentElement.text().trim(); // texts are automatically utf-8 encoded
            const dateString = $('div.g_head')
                .html()
                ?.match(/[0-9]{4}-[0-9]{2}-[0-9]{2}/g)?.[0];
            if (!dateString) return;
            notice.createdAt = strptime(dateString, '%Y-%m-%d');
            notice.isPinned = siteData.isPinned;
            notice.link = url;

            await saveNotice(notice);

            const files: File[] = [];
            $('ul.file_list li a').each((index, element) => {
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

            const category = $('div.cate').text().trim();
            const tags: string[] = [];
            const translateWords: CategoryTag = {
                Undergraduate: '학부',
                Graduate: '대학원',
                취업: '취업',
            };
            if (siteData.tag) {
                tags.push(this.categoryTags[siteData.tag]);
            }
            if (category && category !== '') {
                tags.push(translateWords[category]);
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
        this.log.info('Page opened.', { url });

        if ($ !== undefined) {
            $('ul.list_wrap li').each((index, element) => {
                const titleElement = $(element).find('a');
                let link = absoluteLink(titleElement.attr('href'), this.baseUrl);

                if (link === undefined) return;
                const nextLinkUrlInstance = new URL(link);
                nextLinkUrlInstance.searchParams.delete('pg');
                link = nextLinkUrlInstance.href;
                const isPinned = $(element).attr('class') === 'notice';
                const newSiteData: SiteData = {
                    department: siteData.department,
                    isPinned,
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

            const hasNext = $('a.last').attr('href') !== undefined;
            const urlInstance = new URL(url);
            const page: number = +(urlInstance.searchParams.get('pg') ?? 1);

            if (hasNext) {
                const nextListUrlInstance = new URL(url);
                nextListUrlInstance.searchParams.set('pg', `${page + 1}`);

                const nextList: string = nextListUrlInstance.href;
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

export const mse = new MSECrawler({
    departmentName: '재료공학부',
    departmentCode: 'mse',
    baseUrl: 'https://mse.snu.ac.kr/board/board.php?pg=1&bo_table=',
    departmentCollege: ENGINEERING,
    categoryTags: {
        notice: '공지사항',
        seminar: '세미나',
    },
});
