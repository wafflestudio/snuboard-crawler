import 'reflect-metadata';
import * as Apify from 'apify';
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
    await Promise.all(
        routeList.map(async (startCrawl) => {
            await startCrawl(connection);
        }),
    );
    log.info('Crawl finished.');
    await connection.close();
});
