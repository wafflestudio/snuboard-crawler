import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { load } from 'cheerio';
import { RequestQueue } from 'apify';
import { HUMANITIES, INF } from '../../constants';
import { CategoryCrawler } from '../../classes/categoryCrawler';
import { SiteData } from '../../types/custom-types';
import { absoluteLink, getOrCreate, getOrCreateTags, saveNotice } from '../../utils';
import { File, Notice } from '../../../server/src/notice/notice.entity';
import { strptime } from '../../micro-strptime';

class SpanishCrawler extends CategoryCrawler {
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

            notice.department = siteData.department;
            const noticeElement = $('table.table_basic');
            notice.title = noticeElement.find('tbody tr:nth-child(1) td').text().trim();
            const contentElement = $('td.note_view_textarea');
            let content = contentElement.html() ?? '';
            content = load(content, { decodeEntities: false })('body').html() ?? '';
            // ^ encode non-unicode letters with utf-8 instead of HTML encoding
            notice.content = content;
            notice.contentText = contentElement.text().trim(); // texts are automatically utf-8 encoded
            // example: '2021-02-26'
            notice.createdAt = strptime(siteData.dateString, '%Y-%m-%d');

            notice.isPinned = siteData.isPinned;

            notice.link = url;

            await saveNotice(notice);

            const files: File[] = [];
            $('tr.file td a').each((index, element) => {
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

            const tags: string[] = [this.categoryTags[siteData.tag]];
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
        let lastNoticeId = INF;
        if ($ !== undefined) {
            const urlInstance = new URL(url);
            const page: number = +(urlInstance.searchParams.get('page') ?? 1);

            $('table.table_basic tbody tr').each((index, element) => {
                const noticeNum = $(element).find('td:nth-child(1)').text().trim();
                const isPinned = noticeNum === '공지';
                if (!isPinned && noticeNum !== undefined) {
                    lastNoticeId = Math.min(lastNoticeId, +noticeNum);
                }

                const titleElement = $(element).find('td:nth-child(2) a');
                // const title = titleElement.text();

                const link = absoluteLink(titleElement.attr('href'), request.loadedUrl);

                if (link === undefined) return;
                const nextLinkUrlInstance = new URL(link);
                nextLinkUrlInstance.searchParams.delete('page');
                const nextLink = nextLinkUrlInstance.href;

                const dateString = $(element).find('td:nth-child(4)').text().trim();

                const newSiteData: SiteData = {
                    department: siteData.department,
                    isPinned,
                    isList: false,
                    dateString,
                    commonUrl: siteData.commonUrl,
                    tag: siteData.tag,
                };
                this.log.info('Enqueueing', { nextLink });
                requestQueue.addRequest({
                    url: nextLink,
                    userData: newSiteData,
                });
            });

            const nextListUrlInstance = new URL(url);
            nextListUrlInstance.searchParams.set('page', `${page + 1}`);
            const nextList = nextListUrlInstance.href;
            const hasNext = lastNoticeId > 1;
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

export const spanish = new SpanishCrawler({
    departmentName: '서어서문학과',
    departmentCode: 'spanish',
    departmentCollege: HUMANITIES,
    baseUrl: 'http://spanish.snu.ac.kr/bbs/board.php?page=1&bo_table=',
    categoryTags: {
        m_notice: '학과',
        e_notice: '기타',
        scholarship: '장학',
        employment: '취업',
        question: '기출',
        forms: '서식',
    },
    excludedTag: '미분류',
});
