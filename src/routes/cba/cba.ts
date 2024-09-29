import { RequestQueue } from 'apify';
import { load } from 'cheerio';
import { CheerioCrawlingContext } from 'crawlee';

import { File, Notice } from '../../../server/src/notice/notice.entity.js';
import { Crawler } from '../../classes/crawler.js';
import { CBA } from '../../constants.js';
import { strptime } from '../../micro-strptime.js';
import { SiteData } from '../../types/custom-types';
import { absoluteLink, getOrCreate, getOrCreateTagsWithMessage, removeUrlPageParam, saveNotice } from '../../utils.js';
import { BiosciCrawler } from '../science/biosci.js';

export const cba = new BiosciCrawler({
    departmentName: '경영대학',
    departmentCode: 'cba', // this value must be equal to the filename
    departmentCollege: CBA,
    baseUrl: 'https://cba.snu.ac.kr/newsroom/notice',
});
