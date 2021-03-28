import 'reflect-metadata';
import * as Apify from 'apify';
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

if (process.argv[2] === undefined) {
    console.log('Please enter the department code as the 1st command line argument');
    process.exit();
}

Apify.main(async () => {
    const connection = await createDBConnection();
    await createOctokit();
    log.info('Starting the crawl.');
    await crawlers[process.argv[2]].startCrawl(connection);
    log.info('Crawl finished.');
    await connection.close();
});
