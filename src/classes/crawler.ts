import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { RequestQueue } from 'apify';
import { Connection } from 'typeorm';
import * as Apify from 'apify';
import Request, { RequestOptions } from 'apify/types/request';
import { CrawlerInit, SiteData } from '../types/custom-types';

export abstract class Crawler {
    protected readonly departmentName: string;

    protected readonly departmentCode: string;

    protected readonly departmentCollege: string;

    protected readonly baseUrl: string;

    protected readonly startTime: number;

    protected readonly log;

    public constructor(initData: CrawlerInit) {
        this.departmentName = initData.departmentName;
        this.departmentCode = initData.departmentCode;
        this.departmentCollege = initData.departmentCollege;
        this.baseUrl = initData.baseUrl;
        this.startTime = Math.floor(new Date().getTime() / 1000);

        this.log = Apify.utils.log.child({
            prefix: this.departmentName,
        });
    }

    abstract handlePage(context: CheerioHandlePageInputs): Promise<void>;

    abstract handleList(context: CheerioHandlePageInputs, requestQueue: RequestQueue): Promise<void>;

    abstract startCrawl(connection: Connection): Promise<void>;

    async addVaryingRequest(requestQueue: RequestQueue, requestLike: Request | RequestOptions): Promise<void> {
        requestLike.uniqueKey = `${this.startTime}${requestLike.url}`;
        await requestQueue.addRequest(requestLike);
    }
}
