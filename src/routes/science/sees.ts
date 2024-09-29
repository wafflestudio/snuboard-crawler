import { BiosciCrawler } from './biosci.js';
import { SCIENCE } from '../../constants.js';

export const sees = new BiosciCrawler({
    departmentName: '지구환경과학부',
    departmentCode: 'sees', // this value must be equal to the filename
    departmentCollege: SCIENCE,
    baseUrl: 'https://sees.snu.ac.kr/community/notice?page=1',
});
