import * as path from 'path';
import { Connection, createConnection } from 'typeorm';
import * as sqlite3 from 'sqlite3';
import { ENV } from './env';

export async function createDBConnection(): Promise<Connection> {
    return createConnection({
        type: 'mariadb',
        host: process.env.DATABASE_HOST,
        port: +(process.env.DATABASE_PORT ?? '3306'),
        username: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
        database: process.env.DATABASE_DBNAME,
        entities: [
            path.resolve(__dirname, '../server/src/**/*.entity.js'),
            path.resolve(__dirname, '../server/src/**/*.entity.ts'),
        ],
        synchronize: ENV !== 'production',
    });
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

export async function listExists(departmentCode: string, url?: string): Promise<boolean> {
    const db = await createRequestQueueConnection(departmentCode);

    let result;
    if (url !== undefined) {
        result = await getSqlite(
            db,
            `SELECT id FROM request_queues_requests WHERE json NOT LIKE '%"handledAt":%' AND json LIKE '%"isList":true%' AND url LIKE ? LIMIT 1;`,
            [`${url}%`],
        );
    } else {
        result = await getSqlite(
            db,
            `SELECT id FROM request_queues_requests WHERE json NOT LIKE '%"handledAt":%' AND json LIKE '%"isList":true%' LIMIT 1;`,
        );
    }

    await new Promise((resolve, reject) => {
        db.close((err) => {
            if (err) {
                reject(err);
            } else {
                resolve(true);
            }
        });
    });
    return result?.id !== undefined;
}
