import { EntityTarget, getConnection, getRepository } from 'typeorm';
import { DeepPartial } from 'typeorm/common/DeepPartial';
import { Notice } from '../server/src/notice/notice.entity';
import { Department, NoticeTag, Tag } from '../server/src/department/department.entity';

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
    await getConnection().transaction('READ COMMITTED', async (transactionalEntityManager) => {
        if (!notice.hasId()) {
            notice.cursor = 0;
            await transactionalEntityManager.save(notice);
            notice.cursor = notice.createdAt.getTime() + (notice.id % 1000);
        }
        await transactionalEntityManager.save(notice);
    });
    return notice;
}

export function absoluteLink(link: string | undefined, baseUrl: string): string | undefined {
    if (link === undefined) return undefined;
    return new URL(link, baseUrl).href;
}
