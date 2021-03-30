import { BiosciCrawler } from '../science/biosci';
import { SOCIAL } from '../../constants';

export const econ = new BiosciCrawler({
    departmentName: '경제학부',
    departmentCode: 'econ', // this value must be equal to the filename
    departmentCollege: SOCIAL,
    baseUrl: 'https://econ.snu.ac.kr/announcement/notice',
});
