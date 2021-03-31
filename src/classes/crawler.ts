import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import * as Apify from 'apify';
import { RequestQueue } from 'apify';
import { Connection } from 'typeorm';
import assert from 'assert';
import Request, { RequestOptions } from 'apify/types/request';
import { appendIssue, createIssue } from '../github';
import { CrawlerInit, CrawlerOption, SiteData } from '../types/custom-types';
import { getOrCreate } from '../utils';
import { Department } from '../../server/src/department/department.entity';

export abstract class Crawler {
    protected readonly departmentName: string;

    public readonly departmentCode: string;

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

    startCrawl = async (connection: Connection, crawlerOption?: CrawlerOption): Promise<void> => {
        assert(connection.isConnected);
        this.log.info('Starting crawl for '.concat(this.departmentName));
        const requestQueue = await Apify.openRequestQueue(this.departmentCode); // each queue should have different id
        const department = await getOrCreate(Department, {
            name: this.departmentName,
            college: this.departmentCollege,
        });

        // department-specific initialization urls
        const siteData: SiteData = {
            department,
            isList: crawlerOption?.isList ?? true,
            isPinned: false,
            dateString: '',
        };
        await this.addVaryingRequest(requestQueue, {
            url: crawlerOption?.startUrl ?? this.baseUrl,
            userData: siteData,
        });

        await this.runCrawler(requestQueue, this.handlePage, this.handleList, crawlerOption);
    };

    async runCrawler(
        requestQueue: RequestQueue,
        handlePage: (inputs: CheerioHandlePageInputs) => Promise<void>,
        handleList: (inputs: CheerioHandlePageInputs, queue: RequestQueue) => Promise<void>,
        crawlerOption?: CrawlerOption,
    ): Promise<void> {
        const timeout = crawlerOption?.timeout ?? 10;
        const errorIssueMapping = new Map<string, number>();
        const startTimeString = `${new Date().toLocaleString('ko-KR', {
            timeZone: 'Asia/Seoul',
        })} KST`;
        const crawler = new Apify.CheerioCrawler({
            requestQueue,
            maxConcurrency: 1,
            maxRequestRetries: 0,
            handlePageFunction: async (context) => {
                try {
                    if ((<SiteData>context.request.userData).isList) await handleList(context, requestQueue);
                    else await handlePage(context);
                } catch (err) {
                    const errString = err.toString();
                    const issueNumber = errorIssueMapping.get(errString);
                    const errDetail = `\`\`\`\n${err.stack}\nwhile processing\n${JSON.stringify(
                        context.request,
                        null,
                        2,
                    )}\n\`\`\``;
                    if (issueNumber !== undefined) {
                        await appendIssue(issueNumber, errDetail);
                    } else {
                        errorIssueMapping.set(
                            errString,
                            await createIssue(
                                `[${this.departmentName}] ${errString}`,
                                `Crawler started at ${startTimeString} raised following errors:\n\n${errDetail}`,
                            ),
                        );
                    }
                    throw err;
                } finally {
                    await Apify.utils.sleep(timeout * 1000);
                }
            },
        });

        await crawler.run();
    }

    async addVaryingRequest(requestQueue: RequestQueue, requestLike: Request | RequestOptions): Promise<void> {
        requestLike.uniqueKey = `${this.startTime}${requestLike.url}`;
        await requestQueue.addRequest(requestLike);
    }
}
