import { CategoryCrawler } from '../../classes/categoryCrawler.js';
import { HUMANITIES } from '../../constants.js';

export const meeHak = new CategoryCrawler({
    departmentName: '미학과',
    departmentCode: 'meehak',
    departmentCollege: HUMANITIES,
    baseUrl: 'https://meehak.snu.ac.kr/board/',
    categoryTags: {
        notice: '공지사항',
    },
    excludedTag: '미분류',
});
