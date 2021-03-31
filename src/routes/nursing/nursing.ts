import { BiosciCrawler } from '../science/biosci';
import { NURSING } from '../../constants';

export const nursing = new BiosciCrawler({
    departmentName: '간호학과',
    departmentCode: 'nursing', // this value must be equal to the filename
    departmentCollege: NURSING,
    baseUrl: 'https://nursing.snu.ac.kr/board/notice',
});
