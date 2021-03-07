import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { RequestQueue } from 'apify';
import { Connection } from 'typeorm';
import * as Apify from 'apify';
import {CrawlerInit, SiteData} from '../types/custom-types';
import assert from "assert";
import {getOrCreate, runCrawler} from "../utils";
import {Department} from "../../server/src/department/department.entity";

export abstract class Crawler {
    protected readonly departmentName: string;

    protected readonly departmentCode: string;

    protected readonly baseUrl: string;

    protected readonly log;

    public constructor(initData: CrawlerInit) {
        this.departmentName = initData.departmentName;
        this.departmentCode = initData.departmentCode;
        this.baseUrl = initData.baseUrl;

        this.log = Apify.utils.log.child({
            prefix: this.departmentName,
        });
    }

    abstract handlePage(context: CheerioHandlePageInputs): Promise<void>;

    abstract handleList(context: CheerioHandlePageInputs, requestQueue: RequestQueue): Promise<void>;

    startCrawl = async (connection: Connection): Promise<void> =>  {
        assert(connection.isConnected);
        this.log.info('Starting crawl for '.concat(this.departmentName));
        const requestQueue = await Apify.openRequestQueue(this.departmentCode); // each queue should have different id
        const department = await getOrCreate(Department, { name: this.departmentName, college:'공과대학' });

        // department-specific initialization urls
        const siteData: SiteData = { department, isList: true, isPinned: false, dateString: '' };
        await requestQueue.addRequest({
            url: this.baseUrl,
            userData: siteData,
        });

        await runCrawler(requestQueue, this.handlePage, this.handleList);
    }
}
