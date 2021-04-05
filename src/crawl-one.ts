import 'reflect-metadata';
import * as Apify from 'apify';
import yargs from 'yargs';
import { createDBConnection } from './database.js';
import { crawlerList } from './routes/routeList';
import { createOctokit } from './github';
import { Crawler } from './classes/crawler';

const {
    utils: { log },
} = Apify;
const crawlers: { [key: string]: Crawler } = {};
crawlerList.map((c) => {
    crawlers[c.departmentCode] = c;
});

const args = yargs(process.argv.slice(2))
    .options({
        timeout: { type: 'number', demandOption: false },
        startUrl: { type: 'string', demandOption: false },
        isList: { type: 'boolean', demandOption: false },
    })
    .check((argv) => {
        const departmentCode = argv._[0];
        if (!departmentCode) {
            throw new Error('crawl-one: a department code is required');
        }
        if (!crawlers[departmentCode]) {
            throw new Error(`crawl-one: cannot find department '${departmentCode}'`);
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

Apify.main(async () => {
    const connection = await createDBConnection();
    await createOctokit();
    log.info('Starting the crawl.');
    await crawlers[args._[0]].startCrawl(connection, {
        timeout: args.timeout,
        startUrl: args.startUrl,
        isList: args.startUrl ? args.isList : undefined,
    });
    log.info('Crawl finished.');
    await connection.close();
});
