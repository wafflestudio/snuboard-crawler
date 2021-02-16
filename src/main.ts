import 'reflect-metadata';
import * as Apify from 'apify';
import { getRepository } from 'typeorm';
import { handlePage } from './routes.js';
import { createDBConnection } from './database.js';
import { Department } from '../server/src/department/department.entity';

const {
    utils: { log },
} = Apify;

Apify.main(async () => {
    const connection = await createDBConnection();
    const requestQueue = await Apify.openRequestQueue();

    const departmentRepository = getRepository(Department);
    let department: Department | undefined = await departmentRepository.findOne({ name: '컴퓨터공학부' });
    if (department === undefined) {
        department = new Department();
        department.name = '컴퓨터공학부';
        await departmentRepository.save(department);
    }

    await requestQueue.addRequest({
        url: 'https://cse.snu.ac.kr/node/47407',
        userData: { department, isPinned: false },
    }); // Sample page

    const crawler = new Apify.CheerioCrawler({
        requestQueue,
        maxConcurrency: 1,
        maxRequestRetries: 1,
        handlePageFunction: handlePage,
    });

    log.info('Starting the crawl.');
    await crawler.run();
    log.info('Crawl finished.');
    await connection.close();
});
