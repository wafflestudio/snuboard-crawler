import 'reflect-metadata';
import { Actor } from 'apify';
import { utils } from 'crawlee';
import yargs from 'yargs';

import { CategoryCrawler } from './classes/categoryCrawler.js';
import { Crawler } from './classes/crawler.js';
import { getDataSource } from './database.js';
import { createOctokit } from './github.js';
import { earlyStopList } from './routes/routeList.js';
import { ApifyStorageLocal } from '@apify/storage-local';

const { log } = utils;
const crawlers: { [key: string]: Crawler } = {};
earlyStopList.map((c) => {
    crawlers[c.departmentCode] = c;
});

const args_promise = yargs(process.argv.slice(2))
    .options({
        timeout: { type: 'number', demandOption: false },
        startUrl: { type: 'string', demandOption: false },
        isList: { type: 'boolean', demandOption: false },
        tag: { type: 'string', demandOption: false },
    })
    .check((argv) => {
        const departmentCode = argv._[0];
        if (!departmentCode) {
            throw new Error('crawl-one: a department code is required');
        }
        if (!crawlers[departmentCode]) {
            throw new Error(`crawl-one: cannot find department '${departmentCode}'`);
        }
        if (crawlers[departmentCode] instanceof CategoryCrawler && argv.startUrl && !argv.tag) {
            throw new Error(`crawl-one: CategoryCrawler requires tag`);
        }
        if (argv.startUrl && argv.isList === undefined) {
            throw new Error(`crawl-one: --isList is required when --startUrl is set`);
        }
        if (argv.startUrl) {
            const departmentName = argv.startUrl.match(/:\/\/(.+)\.snu\.ac\.kr/)?.[1];
            if (!departmentName) {
                throw new Error(`crawl-one: invalid startUrl, cannot parse a department name from startUrl`);
            }
            if (!crawlers[departmentName]) {
                throw new Error(`crawl-one: invalid startUrl, cannot find department '${departmentName}'`);
            }
            if (departmentName !== departmentCode) {
                throw new Error(`crawl-one: the department name in startUrl and the department code must be same`);
            }
        }
        return true;
    }).argv;

const storage = new ApifyStorageLocal();
await Actor.init({
    storage,
});
await Actor.main(async () => {
    const args = await args_promise;
    // await createOctokit();
    log.info('Starting the crawl.');
    await crawlers[args._[0]].startCrawl(await getDataSource(), {
        timeout: args.timeout,
        startUrl: args.startUrl,
        isList: args.startUrl ? args.isList : undefined,
        tag: args.tag,
    });
    log.info('Crawl finished.');
    await (await getDataSource()).destroy();
});
await Actor.exit();
