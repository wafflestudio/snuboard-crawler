import * as Apify from 'apify';
import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { getRepository } from 'typeorm';
import { Notice } from '../server/src/notice/notice.entity.js';
import { Department } from '../server/src/department/department.entity';

const {
    utils: { log },
} = Apify;

interface File {
    filename: string;
    url: string;
}

export async function handlePage(context: CheerioHandlePageInputs): Promise<void> {
    const { request, $ } = context;
    const { url } = request;
    log.info('Page opened.', { url });
    const files: Array<File> = [];
    if ($) {
        $('span.file').each(function (_, element) {
            const fileUrl = $(element).children('a').attr('href');
            if (fileUrl)
                files.push({
                    filename: $(element).text().trim(),
                    url: fileUrl,
                });
        });
        let notice: Notice | undefined = await getRepository(Notice).findOne({ link: url });
        if (notice === undefined) {
            notice = new Notice();
        }
        notice.title = $('h1#page-title').text().trim();
        notice.content = $('div.field-name-body').children('div').children('div').html() ?? '';
        // notice.preview = $('div.field-name-body').text();
        const dateString: string = $('div.submitted').text().split(',')[1].substring(8).trim();
        const dateParts = dateString.split(' ')[0].split('/');
        log.info(
            JSON.stringify({
                dateString,
                dateParts,
            }),
        );
        notice.createdAt = new Date(+dateParts[0], +dateParts[1] - 1, +dateParts[2]);
        notice.isPinned = false;
        notice.link = url;
        // notice.noticeTags = $('div.field-name-field-tag').text().substring(4).trim();
        // author: $('span.username').text().trim()
        const departmentRepository = getRepository(Department);
        let department: Department | undefined = await departmentRepository.findOne({ name: '컴퓨터공학부' });
        if (department === undefined) {
            department = new Department();
            department.name = '컴퓨터공학부';
            await departmentRepository.save(department);
        }
        notice.department = department;

        console.log(notice);
        await getRepository(Notice).save(notice);
    }
}
