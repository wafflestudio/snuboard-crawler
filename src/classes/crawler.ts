import assert from 'assert';

import { Actor } from 'apify';
import { RequestQueue, Request, RequestOptions, utils, CheerioCrawler, CheerioCrawlingContext } from 'crawlee';
import * as sqlite3 from 'sqlite3';
import { DataSource } from 'typeorm';

import { Department } from '../../server/src/department/department.entity.js';
import {
    closeSqliteDB,
    createRequestQueueDataSource,
    isBasePushCondition,
    isEarlyStopCondition,
    listCount,
    urlInQueue,
} from '../database.js';
import { appendIssue, createIssue } from '../github.js';
import { CrawlerInit, CrawlerOption, SiteData } from '../types/custom-types';
import { addDepartmentProperty, getOrCreate } from '../utils.js';

export abstract class Crawler {
    public readonly departmentName: string;

    public readonly departmentCode: string;

    public readonly departmentLink: string;

    protected readonly departmentCollege: string;

    protected readonly baseUrl: string;

    protected readonly startTime: number;

    protected readonly encoding: string | undefined;

    protected readonly maxRetries: number;

    protected readonly log;

    protected readonly excludedTags?: string[];

    public readonly style: string;

    protected requestQueueDB?: sqlite3.Database;

    public constructor(initData: CrawlerInit) {
        this.departmentName = initData.departmentName;
        this.departmentCode = initData.departmentCode;
        this.departmentLink = initData.departmentLink ?? `http://${initData.departmentCode}.snu.ac.kr/`;
        this.departmentCollege = initData.departmentCollege;
        this.excludedTags = initData.excludedTags;
        this.style = initData.style ?? '';
        this.baseUrl = initData.baseUrl;
        this.startTime = Math.floor(new Date().getTime() / 1000);

        this.maxRetries = 0;
        this.encoding = undefined;
        this.log = utils.log.child({
            prefix: this.departmentName,
        });
    }

    abstract handlePage(context: CheerioCrawlingContext<SiteData, any>): Promise<void>;

    abstract handleList(context: CheerioCrawlingContext<SiteData, any>, requestQueue: RequestQueue): Promise<void>;

    startCrawl = async (dataSource: DataSource, crawlerOption?: CrawlerOption): Promise<void> => {
        assert(dataSource.isInitialized);
        this.log.info('Starting crawl for '.concat(this.departmentName));
        const requestQueue = await Actor.openRequestQueue(this.departmentCode); // each queue should have different id
        const department = await getOrCreate(Department, {
            name: this.departmentName,
            college: this.departmentCollege,
        });
        await addDepartmentProperty(department, this);
        this.requestQueueDB = await createRequestQueueDataSource(this.departmentCode);
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
        handlePage: (inputs: CheerioCrawlingContext) => Promise<void>,
        handleList: (inputs: CheerioCrawlingContext, queue: RequestQueue) => Promise<void>,
        crawlerOption?: CrawlerOption,
    ): Promise<void> {
        const timeout = crawlerOption?.timeout ?? 10;
        const errorIssueMapping = new Map<string, number>();
        const startTimeString = `${new Date().toLocaleString('ko-KR', {
            timeZone: 'Asia/Seoul',
        })} KST`;
        const crawler = new CheerioCrawler({
            useSessionPool: false,
            requestQueue,
            maxConcurrency: 1,
            maxRequestRetries: this.maxRetries,
            forceResponseEncoding: this.encoding,
            requestHandler: async (context: CheerioCrawlingContext<SiteData, any>) => {
                const handleStartTime = Date.now();
                try {
                    if (context.request.userData.isList) await handleList(context, requestQueue);
                    else await handlePage(context);
                } catch (err: any) {
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
                    if (adjustedTimeout > 0) await utils.sleep(adjustedTimeout);
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
