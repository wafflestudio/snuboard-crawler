import { SCIENCE } from '../../constants';
import { BiosciCrawler } from './biosci';

export const sees = new BiosciCrawler({
    departmentName: '지구환경과학부',
    departmentCode: 'sees', // this value must be equal to the filename
    departmentCollege: SCIENCE,
    baseUrl: 'https://sees.snu.ac.kr/community/notice?page=1',
});
