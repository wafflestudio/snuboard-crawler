import { HUMANITIES } from '../../constants.js';
import { BiosciCrawler } from '../science/biosci.js';

export const humanities = new BiosciCrawler({
    departmentName: '인문대학',
    departmentCode: 'humanities',
    departmentCollege: HUMANITIES,
    baseUrl: 'https://humanities.snu.ac.kr/community/notice',
});
