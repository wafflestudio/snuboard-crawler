import * as Apify from 'apify';
import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';

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

        log.info(
            JSON.stringify({
                title: $('h1#page-title').text().trim(),
                author: $('span.username').text().trim(),
                submitted_at: $('div.submitted').text().split(',')[1].substring(8).trim(),
                files,
                content: $('div.field-name-body').text(),
                content_html: $('div.field-name-body').children('div').children('div').html(),
                tags: $('div.field-name-field-tag').text().substring(4).trim(),
            }),
        );
    }
}
