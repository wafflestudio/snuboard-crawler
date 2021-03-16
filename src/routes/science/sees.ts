import { Crawler } from '../../classes/crawler';
import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { SiteData } from '../../types/custom-types';
import { absoluteLink, getOrCreate, getOrCreateTags, saveNotice } from '../../utils';
import { File, Notice } from '../../../server/src/notice/notice.entity';
import { load } from 'cheerio';
import { strptime } from '../../micro-strptime';
import { RequestQueue } from 'apify';
import { SCIENCE } from '../../constants';

class SeesCrawler extends Crawler {
    protected readonly noticeUrl =
        'http://sees.snu.ac.kr/hs/korean/board/boardView.do?bbsId=BBSMSTR_000000000011&nttId=';

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
            const tr = $('div.view_table table tbody tr');
            notice.title = $(tr[0]).find('td').text().trim();
            const contentElement = $(tr[3]).find('td.subject');

            let content = contentElement.html() ?? '';

            content = load(content, { decodeEntities: false })('body').html() ?? '';
            // ^ encode non-unicode letters with utf-8 instead of HTML encoding
            notice.content = content;
            notice.preview = contentElement.text().substring(0, 1000).trim(); // texts are automatically utf-8 encoded

            notice.createdAt = strptime(siteData.dateString, '%Y-%m-%d');

            notice.isPinned = siteData.isPinned;
            notice.link = url;

            await saveNotice(notice);

            const files: File[] = [];
            $(tr[2])
                .find('td a')
                .each((index, element) => {
                    const fileUrl = $(element).attr('href');
                    if (fileUrl) {
                        const file = new File();
                        file.name = $(element).text().trim();

                        const fileLinkInstance = new URL(absoluteLink('/cmm/fms/FileDown.do?', this.baseUrl) ?? '');
                        let params = fileUrl.match(/'[^\']+'/g) ?? [];
                        params = params.map((param) => {
                            param.substring(1, param.length - 1);
                            return param.substring(1, param.length - 1);
                        });
                        if (params.length < 3) return;

                        fileLinkInstance.searchParams.set('atchFileId', params[0]);
                        fileLinkInstance.searchParams.set('fileSn', params[1]);
                        fileLinkInstance.searchParams.set('nttId', params[2]);
                        file.link = fileLinkInstance.href;
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
        const urlInstance = new URL(request.loadedUrl);
        const page = +(urlInstance.searchParams.get('pageIndex') ?? 1);

        if ($ !== undefined) {
            $('div.list_table table tbody tr').each((index, element) => {
                const titleElement = $(element).find('td:nth-child(2) a').attr('onclick');
                if (!titleElement) return;
                const noticeId = +(titleElement.match(/[\d]+/)?.[0] ?? -1);
                if (noticeId === -1) return;
                const link = this.noticeUrl + noticeId.toString();

                const dateString: string = $(element).find('td:nth-child(3)').text();
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

            const endUrlInstance = new URL(absoluteLink($('div.pagination a.last').attr('href'), this.baseUrl) ?? '');

            const endPage = +(endUrlInstance.searchParams.get('pageIndex') ?? 1);
            if (page < endPage) {
                const nextUrlInstance = new URL(urlInstance.href);
                nextUrlInstance.searchParams.set('pageIndex', (page + 1).toString());
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
        } else {
            throw new TypeError('Selector is undefined');
        }
    };
}

export const sees = new SeesCrawler({
    departmentName: '지구환경과학부',
    departmentCode: 'sees', // this value must be equal to the filename
    departmentCollege: SCIENCE,
    baseUrl: 'http://sees.snu.ac.kr/hs/korean/board/boardList.do',
});
