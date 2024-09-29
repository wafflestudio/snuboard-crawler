import { CategoryCrawler } from '../../classes/categoryCrawler.js';
import { UNION } from '../../constants.js';

export const easia = new CategoryCrawler({
    departmentName: '동아시아비교인문학',
    departmentCode: 'easia', // this value must be equal to the filename
    departmentCollege: UNION,
    baseUrl: 'https://easia.snu.ac.kr/board/',
    categoryTags: {
        notice: '공지사항',
    },
    excludedTag: '미분류',
});
