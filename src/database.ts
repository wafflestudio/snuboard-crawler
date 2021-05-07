import * as path from 'path';
import { Connection, createConnection } from 'typeorm';
import * as sqlite3 from 'sqlite3';
import { TRUE_STRING } from './constants';
import ormConfig from './ormconfig';

export async function createDBConnection(): Promise<Connection> {
    return createConnection(ormConfig);
}

const storageDir = process.env.APIFY_LOCAL_STORAGE_DIR ?? path.resolve(process.cwd(), './apify_storage');

export async function createRequestQueueConnection(departmentCode: string): Promise<sqlite3.Database> {
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

const EARLY_STOP = TRUE_STRING.includes(process.env.EARLY_STOP ?? '');
export async function isEarlyStopCondition(db: sqlite3.Database, url?: string | null): Promise<boolean> {
    if (url === null) url = undefined;
    return EARLY_STOP && !(await listExists(db, url));
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
