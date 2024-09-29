import { CategoryCrawler } from '../../classes/categoryCrawler.js';
import { EDU } from '../../constants.js';

export const histoEdu = new CategoryCrawler({
    departmentName: '역사교육과',
    departmentCode: 'histoedu',
    departmentCollege: EDU,
    baseUrl: 'https://histoedu.snu.ac.kr/board/',
    categoryTags: {
        general: '일반 공지',
    },
    excludedTag: '미분류',
});
