import * as path from 'path';

import { data } from 'cheerio/dist/commonjs/api/attributes';
import sqlite3 from 'sqlite3';
import { DataSource, DataSourceOptions } from 'typeorm';

import { TRUE_STRING } from './constants.js';
import ormConfig from '../server/src/ormconfig.js';
import { Notice } from '../server/src/notice/notice.entity.js';
import * as fs from 'fs';

const dataSource = new DataSource(ormConfig as DataSourceOptions);
dataSource.initialize();

export async function getDataSource(): Promise<DataSource> {
    if (!dataSource.isInitialized)
        await dataSource.initialize();
    return dataSource;
}

const storageDir = process.env.APIFY_LOCAL_STORAGE_DIR ?? path.resolve(process.cwd(), './apify_storage');

export async function createRequestQueueDataSource(departmentCode: string): Promise<sqlite3.Database> {
    const dbFile = path.resolve(storageDir, `./request_queues/${departmentCode}/db.sqlite`);
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbFile, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve(db);
            }
        });
    });
}

export async function getSqlite(db: sqlite3.Database, sql: string, params?: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

export async function getAllSqlite(db: sqlite3.Database, sql: string, params?: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

const EARLY_STOP = TRUE_STRING.includes(process.env.EARLY_STOP ?? '');
export async function isEarlyStopCondition(db: sqlite3.Database, url: string | null): Promise<boolean> {
    return EARLY_STOP && (await noticeCount(db, url)) === 0;
}

export async function isBasePushCondition(db: sqlite3.Database, url?: string): Promise<boolean> {
    if (EARLY_STOP) return !(await listExists(db, url));
    return isQueueEmpty(db, url);
}

export async function isQueueEmpty(db: sqlite3.Database, url?: string): Promise<boolean> {
    let result;
    if (url !== undefined) {
        result = await getSqlite(db, `SELECT id FROM request_queues_requests WHERE json LIKE ? ESCAPE ? LIMIT 1;`, [
            `%"commonUrl":"${url.replace('%', '\\%').replace('_', '\\_')}"%`,
            '\\',
        ]);
    } else {
        result = await getSqlite(db, `SELECT id FROM request_queues_requests LIMIT 1;`);
    }

    return result?.id === undefined;
}

export async function listExists(db: sqlite3.Database, commonUrl?: string): Promise<boolean> {
    let result;
    if (commonUrl !== undefined) {
        result = await getSqlite(
            db,
            `SELECT id FROM request_queues_requests 
             WHERE json NOT LIKE '%"handledAt":%' AND json LIKE '%"isList":true%' AND json LIKE ? ESCAPE ? LIMIT 1;`,
            [`%"commonUrl":"${commonUrl.replace('%', '\\%').replace('_', '\\_')}"%`, '\\'],
        );
    } else {
        result = await getSqlite(
            db,
            `SELECT id FROM request_queues_requests WHERE json NOT LIKE '%"handledAt":%' AND json LIKE '%"isList":true%' LIMIT 1;`,
        );
    }

    return result?.id !== undefined;
}

export async function closeSqliteDB(db: sqlite3.Database): Promise<void> {
    await new Promise((resolve, reject) => {
        db.close((err) => {
            if (err) {
                reject(err);
            } else {
                resolve(true);
            }
        });
    });
}

export async function urlInQueue(db: sqlite3.Database, url: string): Promise<boolean> {
    const result = await getSqlite(
        db,
        `SELECT id FROM request_queues_requests WHERE json NOT LIKE '%"handledAt":%' AND url=? LIMIT 1;`,
        [url],
    );
    return result?.id !== undefined;
}

export async function listCount(db: sqlite3.Database, commonUrl: string | null): Promise<number> {
    let result;
    if (commonUrl === null) {
        result = await getSqlite(
            db,
            `SELECT COUNT(*) FROM request_queues_requests WHERE json NOT LIKE '%"handledAt":%' AND json LIKE '%"isList":true%';`,
        );
    } else {
        result = await getSqlite(
            db,
            `SELECT COUNT(*) FROM request_queues_requests 
             WHERE json NOT LIKE '%"handledAt":%' AND json LIKE '%"isList":true%' AND json LIKE ? ESCAPE ?;`,
            [`%"commonUrl":"${commonUrl.replace('%', '\\%').replace('_', '\\_')}"%`, '\\'],
        );
    }
    return result['COUNT(*)'];
}

export async function noticeCount(db: sqlite3.Database, commonUrl: string | null): Promise<number> {
    let unpinnedUnhandled;
    let unpinnedCount;
    if (commonUrl === null) {
        unpinnedUnhandled = await getAllSqlite(
            db,
            `SELECT url  FROM request_queues_requests WHERE json NOT LIKE '%"handledAt":%' AND json LIKE '%"isList":false%' AND json LIKE '%"isPinned":false%';`,
        );
        unpinnedCount = await getSqlite(
            db,
            `SELECT COUNT(*)  FROM request_queues_requests WHERE json LIKE '%"isList":false%' AND json LIKE '%"isPinned":false%';`,
        );
    } else {
        unpinnedUnhandled = await getAllSqlite(
            db,
            `SELECT url  FROM request_queues_requests 
             WHERE json NOT LIKE '%"handledAt":%' AND json LIKE '%"isList":false%' AND json LIKE ? ESCAPE ? AND json LIKE '%"isPinned":false%';`,
            [`%"commonUrl":"${commonUrl.replace('%', '\\%').replace('_', '\\_')}"%`, '\\'],
        );
        unpinnedCount = await getSqlite(
            db,
            `SELECT COUNT(*)  FROM request_queues_requests 
             WHERE json LIKE '%"isList":false%' AND json LIKE ? ESCAPE ? AND json LIKE '%"isPinned":false%';`,
            [`%"commonUrl":"${commonUrl.replace('%', '\\%').replace('_', '\\_')}"%`, '\\'],
        );
    }

    if (unpinnedCount['COUNT(*)'] === 0) {
        return 1; // continue crawling
    }
    if (unpinnedUnhandled.length === 0) {
        return 0;
    }

    const alreadyCrawled = await dataSource
        .getRepository(Notice)
        .createQueryBuilder('notice')
        .where('link IN (:urls)')
        .setParameter(
            'urls',
            unpinnedUnhandled.map((res: { url: any }) => res.url),
        )
        .getCount();
    return unpinnedUnhandled.length - alreadyCrawled;
}
