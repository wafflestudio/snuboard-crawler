import * as path from 'path';
import { Connection, createConnection } from 'typeorm';
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
        synchronize: ENV !== 'prod',
    });
}
