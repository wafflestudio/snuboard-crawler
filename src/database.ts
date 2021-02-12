import { config } from 'dotenv';
import { Connection, createConnection } from 'typeorm';
import * as path from 'path';

const ENV: string = process.env.NODE_ENV ?? 'dev';
let envFile: string;
if (ENV === 'prod') {
    envFile = '.env.prod';
} else if (ENV === 'ci') {
    envFile = '.env.ci';
} else {
    envFile = '.env.dev';
}

config({ path: path.resolve(process.cwd(), envFile) });

export async function createDBConnection(): Promise<Connection> {
    return createConnection({
        type: 'mysql',
        host: process.env.DATABASE_HOST,
        port: +(process.env.DATABASE_PORT ?? '3306'),
        username: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
        database: process.env.DATABASE_DBNAME,
        entities: [path.resolve(__dirname, '../server/src/**/*.entity.js')],
        synchronize: ENV !== 'prod',
    });
}
