import * as Apify from 'apify';
import { handlePage } from './routes.js';

const {
    utils: { log },
} = Apify;

Apify.main(async () => {
    const requestQueue = await Apify.openRequestQueue();
    await requestQueue.addRequest({ url: 'https://cse.snu.ac.kr/node/47407' }); // Sample page

    const crawler = new Apify.CheerioCrawler({
        requestQueue,
        maxConcurrency: 1,
        handlePageFunction: handlePage,
    });

    log.info('Starting the crawl.');
    await crawler.run();
    log.info('Crawl finished.');
});
