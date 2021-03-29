import { BiosciCrawler } from '../science/biosci';
import { ENGINEERING } from '../../constants';

export const aerospace = new BiosciCrawler({
    departmentName: '항공우주공학과',
    departmentCode: 'aerospace',
    departmentCollege: ENGINEERING,
    baseUrl: 'https://aerospace.snu.ac.kr/board/notice',
});
