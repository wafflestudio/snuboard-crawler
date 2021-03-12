import { config } from 'dotenv';
import path from 'path';

export const ENV: string = process.env.NODE_ENV ?? 'dev';
let envFile: string;
if (ENV === 'prod') {
    envFile = '.env.prod';
} else if (ENV === 'ci') {
    envFile = '.env.ci';
} else {
    envFile = '.env.dev';
}

config({ path: path.resolve(process.cwd(), envFile) });
