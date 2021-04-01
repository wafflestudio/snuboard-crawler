import { SCIENCE } from '../../constants';
import { BiosciCrawler } from '../science/biosci';

export const chem = new BiosciCrawler({
    departmentName: '화학부',
    departmentCode: 'chem',
    departmentCollege: SCIENCE,
    baseUrl: 'https://chem.snu.ac.kr/community/notice',
});
