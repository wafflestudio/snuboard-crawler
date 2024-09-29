import 'reflect-metadata';
import { Actor } from 'apify';
import Promise from 'bluebird';
import { data } from 'cheerio/dist/commonjs/api/attributes.js';
import { utils } from 'crawlee';

import { getDataSource } from './database.js';
import { createOctokit } from './github.js';
import { routeList } from './routes/routeList.js';
import { ApifyStorageLocal } from '@apify/storage-local';

const { log } = utils;

const storage = new ApifyStorageLocal();
await Actor.init({ storage });
await Actor.main(async () => {
    await createOctokit();
    log.info('Starting the crawl.');
    await Promise.map(
        routeList,
        async (startCrawl) => {
            await startCrawl(await getDataSource());
        },
        { concurrency: +(process.env.MAX_CONCURRENCY ?? '10') },
    );
    log.info('Crawl finished.');
    await (await getDataSource()).destroy();
});
await Actor.exit();