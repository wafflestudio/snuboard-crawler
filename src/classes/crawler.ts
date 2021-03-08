import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import * as Apify from 'apify';
import { RequestQueue } from 'apify';
import { Connection } from 'typeorm';
import assert from 'assert';
import Request, { RequestOptions } from 'apify/types/request';
import { CrawlerInit, SiteData } from '../types/custom-types';
import { getOrCreate, runCrawler } from '../utils';
import { Department } from '../../server/src/department/department.entity';

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

    startCrawl = async (connection: Connection): Promise<void> => {
        assert(connection.isConnected);
        this.log.info('Starting crawl for '.concat(this.departmentName));
        const requestQueue = await Apify.openRequestQueue(this.departmentCode); // each queue should have different id
        const department = await getOrCreate(Department, {
            name: this.departmentName,
            college: this.departmentCollege,
        });

        // department-specific initialization urls
        const siteData: SiteData = { department, isList: true, isPinned: false, dateString: '' };
        await this.addVaryingRequest(requestQueue, {
            url: this.baseUrl,
            userData: siteData,
        });

        await runCrawler(requestQueue, this.handlePage, this.handleList);
    };

    async addVaryingRequest(requestQueue: RequestQueue, requestLike: Request | RequestOptions): Promise<void> {
        requestLike.uniqueKey = `${this.startTime}${requestLike.url}`;
        await requestQueue.addRequest(requestLike);
    }
}
