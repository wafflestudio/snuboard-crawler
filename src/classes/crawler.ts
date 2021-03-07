import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import * as Apify from 'apify';
import { RequestQueue } from 'apify';
import { Connection } from 'typeorm';
import { CrawlerInit, SiteData } from '../types/custom-types';
import { appendIssue, createIssue } from '../github';

export abstract class Crawler {
    protected readonly departmentName: string;

    protected readonly departmentCode: string;

    protected readonly departmentCollege: string;

    protected readonly baseUrl: string;

    protected readonly log;

    public constructor(initData: CrawlerInit) {
        this.departmentName = initData.departmentName;
        this.departmentCode = initData.departmentCode;
        this.departmentCollege = initData.departmentCollege;
        this.baseUrl = initData.baseUrl;

        this.log = Apify.utils.log.child({
            prefix: this.departmentName,
        });
    }

    abstract handlePage(context: CheerioHandlePageInputs): Promise<void>;

    abstract handleList(context: CheerioHandlePageInputs, requestQueue: RequestQueue): Promise<void>;

    abstract startCrawl(connection: Connection): Promise<void>;

    async runCrawler(
        requestQueue: RequestQueue,
        handlePage: (inputs: CheerioHandlePageInputs) => Promise<void>,
        handleList: (inputs: CheerioHandlePageInputs, queue: RequestQueue) => Promise<void>,
    ): Promise<void> {
        const timeout = 10;
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
}
