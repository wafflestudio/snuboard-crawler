import * as Apify from 'apify';
import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { getRepository } from 'typeorm';
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
        $('span.file').each(function (_, element) {
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
        notice.content = contentElement.children('div').children('div').html() ?? '';
        notice.preview = contentElement.text();
        const dateString: string = $('div.submitted').text().split(',')[1].substring(8).trim();
        const dateParts = dateString.split(' ')[0].split('/');
        notice.createdAt = new Date(+dateParts[0], +dateParts[1] - 1, +dateParts[2]);
        notice.isPinned = siteData.isPinned;
        notice.link = url;
        // notice.noticeTags = $('div.field-name-field-tag').text().substring(4).trim();
        // author: $('span.username').text().trim()
        await getRepository(Notice).save(notice);
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
