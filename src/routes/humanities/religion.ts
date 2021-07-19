import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { load } from 'cheerio';
import { RequestQueue } from 'apify';
import { CategoryCrawler } from '../../classes/categoryCrawler';
import { HUMANITIES } from '../../constants';
import { CategoryTag, SiteData } from '../../types/custom-types';
import { absoluteLink, getOrCreate, getOrCreateTags, saveNotice } from '../../utils';
import { File, Notice } from '../../../server/src/notice/notice.entity';
import { strptime } from '../../micro-strptime';

class ReligionCrawler extends CategoryCrawler {
    categoryId: CategoryTag = {
        '1995': 'notice',
        '1997': 'news_event',
        '1999': 'news_research',
    };

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

            if (siteData.tag === undefined) return;
            const idCss = this.categoryId[siteData.tag];

            notice.department = siteData.department;
            notice.title = $(`tr#mb_${idCss}_tr_title td span:nth-child(1)`).text().trim();
            const contentElement = $(`tr#mb_${idCss}_tr_content td`);
            let content = contentElement.html() ?? '';
            content = load(content, { decodeEntities: false })('body').html() ?? '';
            // ^ encode non-unicode letters with utf-8 instead of HTML encoding
            notice.content = content;
            notice.contentText = contentElement.text().trim(); // texts are automatically utf-8 encoded
            const fullDateString: string = $(`tr#mb_${idCss}_tr_title td span:nth-child(2)`).text().trim();
            // example: '2021-02-26 11:34'
            notice.createdAt = strptime(fullDateString, '%Y-%m-%d %H:%M');

            notice.isPinned = siteData.isPinned;

            notice.link = url;

            await saveNotice(notice);

            const files: File[] = [];
            $(`tr#mb_${idCss}_tr_file_download td a`).each((index, element) => {
                const file = new File();
                file.name = $(element).text().trim();
                file.link = notice.link;
                files.push(file);
            });

            await Promise.all(
                // using Promise.all in order to ensure full execution
                files.map(async (file) => {
                    file.notice = notice;
                    await getOrCreate(File, file);
                }),
            );

            let tags: string[] = [];
            const category = siteData.tag;
            if (category && this.categoryTags[category] && !tags.includes(this.categoryTags[category])) {
                tags.push(this.categoryTags[category]);
            }
            tags = tags.filter((tag) => tag !== this.excludedTag);
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
            const urlInstance = new URL(url);
            const page: number = +(urlInstance.searchParams.get('board_page') ?? 1);

            $('div.main-style1 table tbody tr').each((index, element) => {
                const isPinned = $(element).hasClass('mb-notice');

                const titleElement = $(element).find('td:nth-child(2) a');
                // const title = titleElement.text();

                const link = absoluteLink(titleElement.attr('href'), request.loadedUrl);

                if (link === undefined) return;
                const nextLinkUrlInstance = new URL(link);
                nextLinkUrlInstance.searchParams.delete('board_page');
                const nextLink = nextLinkUrlInstance.href;

                const dateString = $($(element).children('td')[3]).text().trim();

                const newSiteData: SiteData = {
                    department: siteData.department,
                    isPinned,
                    isList: false,
                    dateString,
                    tag: siteData.tag,
                };
                this.log.info('Enqueueing', { nextLink });
                requestQueue.addRequest({
                    url: nextLink,
                    userData: newSiteData,
                });
            });

            const nextListUrlInstance = new URL(url);
            nextListUrlInstance.searchParams.set('board_page', `${page + 1}`);
            const nextList = nextListUrlInstance.href;
            const hasNext = $('a.btn-end').attr('href') !== undefined;
            if (hasNext) {
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

export const religion = new ReligionCrawler({
    departmentName: '종교학과',
    departmentCode: 'religion',
    departmentCollege: HUMANITIES,
    baseUrl: 'http://religion.snu.ac.kr/?mode=list&board_page=1&page_id=',
    categoryTags: {
        '1995': '공지사항',
        '1997': '학과소식',
        '1999': '학술행사',
    },
    excludedTag: '미분류',
});
