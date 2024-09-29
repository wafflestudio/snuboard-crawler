import { CategoryCrawler } from '../../classes/categoryCrawler.js';
import { EDU } from '../../constants.js';

export const physed = new CategoryCrawler({
    departmentName: '물리교육과',
    departmentCode: 'physed',
    departmentCollege: EDU,
    baseUrl: 'https://physed.snu.ac.kr/ko/board/',
    categoryTags: {
        notice: '공지사항',
        Scholarship: '장학',
        event: '행사',
        incruit: '취업 및 아르바이트',
    },
    excludedTag: '미분류',
});
