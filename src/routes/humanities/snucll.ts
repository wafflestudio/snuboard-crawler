import { CategoryCrawler } from '../../classes/categoryCrawler';
import { HUMANITIES } from '../../constants';
import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { SiteData } from '../../types/custom-types';
import { absoluteLink, getOrCreate, getOrCreateTags, parseTitle, saveNotice } from '../../utils';
import { File, Notice } from '../../../server/src/notice/notice.entity';
import { load } from 'cheerio';
import { strptime } from '../../micro-strptime';
import { RequestQueue } from 'apify';

class SnucllCrawler extends CategoryCrawler {
    handlePage = async (context: CheerioHandlePageInputs): Promise<void> => {
        const { request, $ } = context;
        const { url } = request;
        const siteData = <SiteData>request.userData;
        const urlInstance = new URL(url);

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
            notice.title = $('tr.headertr').first().text().trim();
            const contentElement = $('div.viewbox');
            let content = contentElement.html() ?? '';
            content = load(content, { decodeEntities: false })('body').html() ?? '';
            // ^ encode non-unicode letters with utf-8 instead of HTML encoding
            notice.content = content;
            notice.contentText = contentElement.text().trim(); // texts are automatically utf-8 encoded
            // example: '2021-02-26 11:34'
            notice.createdAt = strptime(siteData.dateString, '%Y-%m-%d');

            notice.isPinned = siteData.isPinned;

            notice.link = url;

            await saveNotice(notice);
            const seqNo = urlInstance.searchParams.get('BoardSeqNo');
            const boardId = urlInstance.searchParams.get('BoardID');

            const files: File[] = [];

            $('tr.filetr td button').each((index, element) => {
                const fileUrlInstance = new URL(
                    `http://snucll.snu.ac.kr/board/board_down.php?BoardID=${boardId}&BoardSeqNo=${seqNo}&page=1&search_what=title&keyword=&mnuKind=&FileSeqNo=1&FileItemName=Attach&ComentSeqNo=&ComPos=&MemberSeqNo=&Mode=I`,
                );
                const fileParams = $(element)
                    .attr('onclick')
                    ?.match(/'[^']+'/g)
                    ?.map((param) => {
                        return param.slice(1, -1);
                    });
                if (!fileParams) return;
                const file = new File();
                file.name = $(element).text().trim();
                fileUrlInstance.searchParams.set('FileSeqNo', fileParams[0]);
                fileUrlInstance.searchParams.set('FileItemName', fileParams[1]);
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

            const tags: string[] = siteData.tag === undefined ? [] : [siteData.tag];
            const categories = ['공지사항', '장학정보', '취업정보', '중문과 소식', '채용정보'];
            if (boardId === null) return;
            tags.push(categories[+boardId - 1]);
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
            const page: number = +(urlInstance.searchParams.get('page') ?? 1);

            $('table.board_table tr').each((index, element) => {
                const isPinned = $(element).find('td:nth-child(1)').text().trim() === '';
                const titleElement = $(element).find('td:nth-child(2) a');
                const titleTags = parseTitle(titleElement.text());

                const seqNo = titleElement.attr('boardseqno');
                if (seqNo === undefined) return;
                const nextLinkUrlInstance = new URL(`http://snucll.snu.ac.kr/board/board_view.php?${siteData.tag}`);
                nextLinkUrlInstance.searchParams.set('BoardSeqNo', seqNo);
                const nextLink = nextLinkUrlInstance.href;

                const dateString = $(element).find('td:nth-child(4)').text().trim();

                const newSiteData: SiteData = {
                    department: siteData.department,
                    isPinned,
                    isList: false,
                    dateString,
                    tag: titleTags.tags?.[0],
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
            const hasNext = $('div.pagination li').last().find('a').attr('onclick') !== undefined;
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

export const snuCll = new SnucllCrawler({
    departmentName: '중어중문학과',
    departmentCode: 'snucll',
    departmentCollege: HUMANITIES,
    baseUrl: 'http://snucll.snu.ac.kr/board/board_list.php?',
    categoryTags: {
        'Mode=I&BoardID=1&page=1&BoardSeqNo=&mnuKind=&search_what=title&keyword=': '공지사항',
        'Mode=I&BoardID=2&page=1&BoardSeqNo=&mnuKind=&search_what=title&keyword=': '장학정보',
        'Mode=I&BoardID=3&page=1&BoardSeqNo=&mnuKind=&search_what=title&keyword=': '취업정보',
        'Mode=I&BoardID=4&page=1&BoardSeqNo=&mnuKind=&search_what=title&keyword=': '중문과 소식',
        'Mode=I&BoardID=5&page=1&BoardSeqNo=&mnuKind=&search_what=title&keyword=': '채용정보',
    },
    excludedTag: '미분류',
});
