import 'reflect-metadata';
import * as Apify from 'apify';
import { Promise } from 'bluebird';
import { createDBConnection } from './database.js';
import { routeList } from './routes/routeList';
import { createOctokit } from './github';

const {
    utils: { log },
} = Apify;

Apify.main(async () => {
    const connection = await createDBConnection();
    await createOctokit();
    log.info('Starting the crawl.');
    await Promise.map(
        routeList,
        async (startCrawl) => {
            await startCrawl(connection);
        },
        { concurrency: 2 },
    );
    log.info('Crawl finished.');
    await connection.close();
});
