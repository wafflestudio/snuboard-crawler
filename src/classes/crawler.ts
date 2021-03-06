import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { RequestQueue } from 'apify';
import { Connection } from 'typeorm';
import * as Apify from 'apify';
import { CrawlerInit } from '../types/custom-types';

export abstract class Crawler {
    protected readonly departmentName: string;

    protected readonly departmentCode: string;

    protected readonly baseUrl: string;

    protected readonly log;

    protected constructor(initData: CrawlerInit) {
        this.departmentName = initData.departmentName;
        this.departmentCode = initData.departmentCode;
        this.baseUrl = initData.baseUrl;

        this.log = Apify.utils.log;
    }

    abstract handlePage(context: CheerioHandlePageInputs): Promise<void>;

    abstract handleList(context: CheerioHandlePageInputs, requestQueue: RequestQueue): Promise<void>;

    abstract startCrawl(connection: Connection): Promise<void>;
}