import * as Apify from 'apify';
import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { getRepository } from 'typeorm';
import { RequestQueue } from 'apify';
import { load } from 'cheerio';
import { Notice, File } from '../server/src/notice/notice.entity.js';
import { NoticeTag, Tag } from '../server/src/department/department.entity';
import { SiteData } from './types/custom-types';

const {
    utils: { log },
} = Apify;

export async function handlePage(context: CheerioHandlePageInputs): Promise<void> {
    const { request, $ } = context;
    const { url } = request;
    const siteData = <SiteData>request.userData;

    log.info('Page opened.', { url });
    const files: Array<File> = [];
    if ($) {
        // creation order
        // dept -> notice -> file
        //                -> tag -> notice_tag
        $('span.file').each(function (index, element) {
            const fileUrl = $(element).children('a').attr('href');
            if (fileUrl) {
                const file = new File();
                file.name = $(element).text().trim();
                file.link = fileUrl;
                files.push(file);
            }
        });

        const notice: Notice = (await getRepository(Notice).findOne({ link: url })) ?? new Notice();

        notice.department = siteData.department;
        notice.title = $('h1#page-title').text().trim();
        const contentElement = $('div.field-name-body');

        let content = contentElement.children('div').children('div').html() ?? '';
        content = load(content, { decodeEntities: false })('body').html() ?? '';
        notice.content = content;
        notice.preview = contentElement.text().substring(0, 1000);
        // const dateString: string = $('div.submitted').text().split(',')[1].substring(8).trim().split(' ')[0];
        const dateParts = siteData.dateString.split('/');
        notice.createdAt = new Date(+dateParts[0], +dateParts[1] - 1, +dateParts[2]);
        notice.isPinned = siteData.isPinned;
        notice.link = url;
        // notice.noticeTags = $('div.field-name-field-tag').text().substring(4).trim();
        // author: $('span.username').text().trim()
        notice.cursor = notice.createdAt.getTime();
        await notice.save();
        notice.cursor += notice.id % 1000;
        await notice.save();

        const FileRepository = await getRepository(File);
        await Promise.all(
            files.map(async (file) => {
                file.notice = notice;
                if ((await FileRepository.findOne(file)) === undefined) FileRepository.save(file);
            }),
        );

        const tags = $('div.field-name-field-tag').text().substring(4).trim().split(', ');
        const TagRepository = await getRepository(Tag);
        const NoticeTagRepository = await getRepository(NoticeTag);
        await Promise.all(
            tags.map(async (tagName) => {
                const tagDetail = { department: siteData.department, name: tagName };
                const tag: Tag = (await TagRepository.findOne(tagDetail)) ?? TagRepository.create(tagDetail);
                if (!tag.hasId()) await tag.save();

                const noticeTagDetail = { notice, tag };
                const noticeTag: NoticeTag =
                    (await NoticeTagRepository.findOne(noticeTagDetail)) ?? NoticeTagRepository.create(noticeTagDetail);
                if (!noticeTag.hasId()) await noticeTag.save();
            }),
        );
    }
}

export async function handleList(context: CheerioHandlePageInputs, requestQueue: RequestQueue): Promise<void> {
    const { request, $ } = context;
    const { url } = request;
    const siteData = <SiteData>request.userData;
    log.info('Page opened.', { url });
    if ($) {
        $('table.views-table tbody tr').each(function (index, element) {
            const isPinned = $(element).attr('class')?.split(' ').includes('sticky') ?? false;
            const titleElement = $($($(element).children('td')[0]).children('a'));
            // const title = titleElement.text();
            let link = titleElement.attr('href');
            const dateString = $($(element).children('td')[1]).text().trim();
            // const viewCount = +$($(element).children('td')[2]).text().trim() ?? 0;
            if (link === undefined) return;
            link = new URL(link, request.loadedUrl).href;
            if (link === undefined) return;
            const newSiteData: SiteData = {
                department: siteData.department,
                isPinned,
                isList: false,
                dateString,
            };
            log.info('Enqueueing', { link });
            requestQueue.addRequest({
                url: link,
                userData: newSiteData,
            });
        });
        let nextList = $('li.pager-next').children('a').attr('href');
        if (nextList === undefined) return;
        nextList = new URL(nextList, request.loadedUrl).href;
        if (nextList === undefined) return;
        log.info('Enqueueing list', { nextList });

        const nextListSiteData: SiteData = {
            department: siteData.department,
            isPinned: false,
            isList: true,
            dateString: '',
        };
        await requestQueue.addRequest({
            url: <string>nextList,
            userData: nextListSiteData,
        });
    }
}
