import 'reflect-metadata';
import * as Apify from 'apify';
import { getRepository } from 'typeorm';
import { handleList, handlePage } from './routes.js';
import { createDBConnection } from './database.js';
import { Department } from '../server/src/department/department.entity';
import { SiteData } from './types/custom-types';
import { timeouts } from './constants';

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
        url: 'https://cse.snu.ac.kr/department-notices',
        userData: { department, isList: true, isPinned: false },
    });

    const timeout: number = timeouts.get(department.name) ?? 10;
    let visitCount = 0;
    const maxVisitCount = 30;

    const crawler = new Apify.CheerioCrawler({
        requestQueue,
        maxConcurrency: 1,
        maxRequestRetries: 1,
        handlePageFunction: async (context) => {
            visitCount += 1;
            if (visitCount > maxVisitCount) return; // don't crawl everything for development

            try {
                if ((<SiteData>context.request.userData).isList) await handleList(context, requestQueue);
                else await handlePage(context);
            } finally {
                await Apify.utils.sleep(timeout * 1000);
            }
        },
    });

    log.info('Starting the crawl.');
    await crawler.run();
    log.info('Crawl finished.');
    await connection.close();
});
