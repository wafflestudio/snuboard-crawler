import { CheerioHandlePageInputs } from 'apify/types/crawlers/cheerio_crawler';
import { load } from 'cheerio';
import { RequestQueue } from 'apify';
import { Crawler } from '../../classes/crawler';
import { CBA } from '../../constants';
import { SiteData } from '../../types/custom-types';
import { absoluteLink, getOrCreate, getOrCreateTags, removeUrlPageParam, saveNotice } from '../../utils';
import { File, Notice } from '../../../server/src/notice/notice.entity';
import { strptime } from '../../micro-strptime';
import { BiosciCrawler } from '../science/biosci';

export const cba = new BiosciCrawler({
    departmentName: '경영대학',
    departmentCode: 'cba', // this value must be equal to the filename
    departmentCollege: CBA,
    baseUrl: 'https://cba.snu.ac.kr/newsroom/notice',
});
