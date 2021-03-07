import { EntityTarget, getRepository } from 'typeorm';
import { DeepPartial } from 'typeorm/common/DeepPartial';
import { RequestQueue } from 'apify';
import * as Apify from 'apify';
import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { Notice } from '../server/src/notice/notice.entity';
import { Department, NoticeTag, Tag } from '../server/src/department/department.entity';
import { SiteData } from './types/custom-types';
import {CURSOR_RAND_MAX} from './constants';

export async function getOrCreate<T>(Entity: EntityTarget<T>, entityLike: DeepPartial<T>, save = true): Promise<T> {
    // find T element with entityLike property if it exists.
    // otherwise, create new T element with entityLike property
    // if save is true, the newly created element will be saved to DB.
    const repository = getRepository(Entity);
    let element: T | undefined = await repository.findOne(entityLike);
    if (element === undefined) {
        element = repository.create(entityLike);
        if (save) await repository.save(element);
    }
    return element;
}

export async function getOrCreateTags(tags: string[], notice: Notice, department: Department): Promise<void> {
    // tags: list of tag names
    // creates Tag and NoticeTag elements.
    await Promise.all(
        tags.map(async (tagName) => {
            const tag = await getOrCreate(Tag, { department, name: tagName });
            await getOrCreate(NoticeTag, { notice, tag });
        }),
    );
}

export async function saveNotice(notice: Notice): Promise<Notice> {
    // populate notice.cursor and save notice
    if (!notice.hasId()) {
        notice.cursor = Math.floor(Math.random() * CURSOR_RAND_MAX);
        await notice.save();
        notice.cursor = notice.createdAt.getTime()+ notice.id % 1000;
    }
    await notice.save();
    return notice;
}

export function absoluteLink(link: string | undefined, baseUrl: string): string | undefined {
    if (link === undefined) return undefined;
    return new URL(link, baseUrl).href;
}

export async function runCrawler(
    requestQueue: RequestQueue,
    handlePage: (inputs: CheerioHandlePageInputs) => Promise<void>,
    handleList: (inputs: CheerioHandlePageInputs, queue: RequestQueue) => Promise<void>,
): Promise<void> {
    const timeout = 10;

    const crawler = new Apify.CheerioCrawler({
        requestQueue,
        maxConcurrency: 1,
        maxRequestRetries: 0,
        handlePageFunction: async (context) => {
            try {
                if ((<SiteData>context.request.userData).isList) await handleList(context, requestQueue);
                else await handlePage(context);
            } finally {
                await Apify.utils.sleep(timeout * 1000);
            }
        },
    });

    await crawler.run();
}
