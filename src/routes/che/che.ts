import { CategoryCrawler } from '../../classes/categoryCrawler.js';
import { CHE } from '../../constants.js';

export const che = new CategoryCrawler({
    departmentName: '생활과학대학',
    departmentCode: 'che',
    departmentCollege: CHE,
    baseUrl: 'https://che.snu.ac.kr/board/',
    categoryTags: {
        notice: '공지사항',
    },
    excludedTag: '미분류',
});
