import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import * as Apify from 'apify';
import { RequestQueue } from 'apify';
import { Connection } from 'typeorm';
import assert from 'assert';
import Request, { RequestOptions } from 'apify/types/request';
import * as sqlite3 from 'sqlite3';
import { appendIssue, createIssue } from '../github';
import { CrawlerInit, CrawlerOption, SiteData } from '../types/custom-types';
import { getOrCreate } from '../utils';
import { Department } from '../../server/src/department/department.entity';
import {
    closeSqliteDB,
    createRequestQueueConnection,
    isBasePushCondition,
    isEarlyStopCondition,
    listCount,
    urlInQueue,
} from '../database';

export abstract class Crawler {
    protected readonly departmentName: string;

    public readonly departmentCode: string;

    public readonly departmentLink: string;

    protected readonly departmentCollege: string;

    protected readonly baseUrl: string;

    protected readonly startTime: number;

    protected readonly encoding: string | undefined;

    protected readonly maxRetries: number;

    protected readonly log;

    protected readonly excludedTags?: string[];

    protected requestQueueDB?: sqlite3.Database;

    public constructor(initData: CrawlerInit) {
        this.departmentName = initData.departmentName;
        this.departmentCode = initData.departmentCode;
        this.departmentLink = initData.departmentLink ?? `http://${initData.departmentCode}.snu.ac.kr/`;
        this.departmentCollege = initData.departmentCollege;
        this.excludedTags = initData.excludedTags;
        this.baseUrl = initData.baseUrl;
        this.startTime = Math.floor(new Date().getTime() / 1000);

        this.maxRetries = 0;
        this.encoding = undefined;
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
        department.link = this.departmentLink;
        await Department.save(department);
        this.requestQueueDB = await createRequestQueueConnection(this.departmentCode);
        // department-specific initialization urls
        const siteData: SiteData = {
            department,
            isList: crawlerOption?.isList ?? true,
            isPinned: false,
            dateString: '',
            commonUrl: null,
        };
        if (crawlerOption && crawlerOption.startUrl) {
            this.log.info('Adding startUrl', { startUrl: crawlerOption.startUrl });
            await this.addVaryingRequest(
                requestQueue,
                {
                    url: crawlerOption?.startUrl,
                    userData: siteData,
                },
                siteData.commonUrl,
                false,
            );
        } else if (await isBasePushCondition(this.requestQueueDB)) {
            this.log.info('Adding baseUrl');
            await this.addVaryingRequest(
                requestQueue,
                {
                    url: this.baseUrl,
                    userData: siteData,
                },
                siteData.commonUrl,
                false,
            );
        } else {
            this.log.info('Skipping adding baseUrl');
        }
        await this.runCrawler(requestQueue, this.handlePage, this.handleList, crawlerOption);
        await closeSqliteDB(this.requestQueueDB);
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
            useSessionPool: false,
            requestQueue,
            maxConcurrency: 1,
            maxRequestRetries: this.maxRetries,
            forceResponseEncoding: this.encoding,
            handlePageFunction: async (context) => {
                const handleStartTime = Date.now();
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
                    const handleEndTime = Date.now();
                    const adjustedTimeout = timeout * 1000 - (handleEndTime - handleStartTime);
                    if (adjustedTimeout > 0) await Apify.utils.sleep(adjustedTimeout);
                }
            },
        });

        await crawler.run();
        this.log.info('Crawler Ended');
    }

    async addVaryingRequest(
        requestQueue: RequestQueue,
        requestLike: Request | RequestOptions,
        commonUrl: string | null | undefined,
        checkEarlyStop = true,
    ): Promise<void> {
        if (this.requestQueueDB === undefined) throw Error('requestQueueDB must be initialized');
        if (commonUrl === undefined) throw Error('commonUrl must be either string or null');
        if (checkEarlyStop && (await isEarlyStopCondition(this.requestQueueDB, commonUrl))) {
            this.log.info(`Early Stopping Crawler, commonUrl: ${commonUrl}`);
            return;
        }
        if (await urlInQueue(this.requestQueueDB, requestLike.url)) {
            this.log.info(`Skipping Enqueue list ${requestLike.url} since it is already in queue`);
        } else if ((await listCount(this.requestQueueDB, commonUrl)) > 1) {
            // 1 is the currently running list.
            this.log.info(
                `Skipping Enqueue list ${requestLike.url} since url starting with ${commonUrl} is already running`,
            );
        } else {
            requestLike.uniqueKey = `${this.startTime}${requestLike.url}`;
            await requestQueue.addRequest(requestLike);
        }
    }
}
