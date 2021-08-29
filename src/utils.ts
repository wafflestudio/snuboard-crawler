import { EntityTarget, getConnection, getRepository } from 'typeorm';
import { DeepPartial } from 'typeorm/common/DeepPartial';
import { Buffer } from 'buffer';
import { Notice } from '../server/src/notice/notice.entity';
import { Department, NoticeTag, Tag } from '../server/src/department/department.entity';
import { StringKey, TitleAndTags } from './types/custom-types';
import { Crawler } from './classes/crawler';
import { sendNoticeCreationMessage } from './firebase';
import { TRUE_STRING } from './constants';

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

export async function getOrCreateTagsWithMessage(
    tags: string[],
    notice: Notice,
    department: Department,
    excludedTags?: string[],
): Promise<void> {
    // tags: list of tag names
    // creates Tag and NoticeTag elements.
    tags = tags.filter((tag) => tag.length > 0);
    if (excludedTags !== undefined) {
        tags = tags.filter((tag) => !excludedTags.includes(tag));
    }

    const isMessage = TRUE_STRING.includes(process.env.MESSAGE ?? '');
    if (isMessage) {
        await sendMessageIfCreated(tags, notice, department);
    }

    await getOrCreateTags(tags, notice, department);
}

export async function sendMessageIfCreated(tags: string[], notice: Notice, department: Department) {
    const isSendMessageCondition = await NoticeTag.findOne({ notice });
    if (isSendMessageCondition === undefined) {
        let idx = 0;
        const offset = 5;
        while (idx < tags.length) {
            await sendNoticeCreationMessage(
                parseTagsToCondition(tags.slice(idx, idx + offset), department),
                notice,
                department,
                tags,
            );
            idx += offset;
        }
    }
}

export function parseTagsToCondition(tags: string[], department: Department) {
    return tags.reduce((acc, cur, idx) => {
        let operator = '|| ';
        if (idx === tags.length - 1) operator = '';
        return `${acc} '${encodeTag(cur, department)}' in topics ${operator}`.trim();
    }, '');
}

export function parseTagsToStringWithSeparator(tags: string[], separator: string) {
    return tags.reduce((acc, cur, idx) => {
        if (idx === tags.length - 1) separator = '';
        return `${acc}${cur}${separator}`;
    }, '');
}

export async function getOrCreateTags(tags: string[], notice: Notice, department: Department): Promise<void> {
    // tags: list of tag names
    // creates Tag and NoticeTag elements.
    await Promise.all(
        tags.map(async (tagName) => {
            const tag = await getOrCreate(Tag, { department, name: tagName });
            await getOrCreate(NoticeTag, { notice, tag, noticeCreatedAt: notice.createdAt });
        }),
    );
}

export async function saveNotice(notice: Notice): Promise<Notice> {
    await Notice.save(notice);
    return notice;
}

export function absoluteLink(link: string | undefined, baseUrl: string): string | undefined {
    if (link === undefined) return undefined;
    return new URL(link, baseUrl).href;
}

export function removeUrlPageParam(link: string | undefined): string | undefined {
    if (link === undefined) return undefined;
    const pageUrl = new URL(link);
    if (!pageUrl) return undefined;
    pageUrl.searchParams.delete('page');
    link = pageUrl.href;

    return link;
}

export function parseTitle(titleText: string): TitleAndTags {
    const titleRe = /((?:\[.*?\]\s{0,2})*)(.*)/;
    const titleAndTags = titleText.trim().match(titleRe);
    const title = titleAndTags && titleAndTags[2] ? titleAndTags[2].trim() : titleText.trim();

    const tags =
        titleAndTags && titleAndTags[1]
            ? titleAndTags[1]
                  .split('[')
                  .map((tag) => tag.replace(']', '').trim())
                  .filter((tag) => tag.length)
            : [];
    return { title, tags };
}

export async function addDepartmentProperty(department: Department, crawler: Crawler) {
    department.link = crawler.departmentLink;
    department.style = crawler.style;
    department.code = Buffer.from(crawler.departmentName)
        .toString('base64')
        .replace('+', 'Xx')
        .replace('=', 'Yy')
        .replace('/', 'Zz');
    await Department.save(department);
}

function encodeTag(tag: string, department: Department) {
    const rawTopic = `${department.name}/${tag}`;
    const replacement: StringKey = { '+': '-', '/': '_', '=': '%' };
    return Buffer.from(rawTopic)
        .toString('base64')
        .replace(/[+/=]/g, (str) => {
            return replacement[str];
        });
}
