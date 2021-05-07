import { CHE } from '../../constants';
import { CategoryCrawler } from '../../classes/categoryCrawler';

export const childFamily = new CategoryCrawler({
    departmentName: '아동가족학과',
    departmentCode: 'childfamily',
    departmentCollege: CHE,
    baseUrl: 'https://childfamily.snu.ac.kr/board/',
    categoryTags: {
        notice_1: '공지사항',
        notice_2: '장학',
        notice_3: '교환학생 & 해외대학',
        notice_4: '학외',
    },
    excludedTag: '미분류',
});
