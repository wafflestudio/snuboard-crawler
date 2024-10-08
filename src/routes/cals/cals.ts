import { CALS } from '../../constants.js';
import { BiosciCrawler } from '../science/biosci.js';

export const cals = new BiosciCrawler({
    departmentName: '농업생명과학대학',
    departmentCode: 'cals', // this value must be equal to the filename
    departmentCollege: CALS,
    baseUrl: 'https://cals.snu.ac.kr/board/notice',
});
