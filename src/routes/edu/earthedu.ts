import { CategoryCrawler } from '../../classes/categoryCrawler';
import { EDU } from '../../constants';

export const earthEdu = new CategoryCrawler({
    departmentName: '지구과학교육과',
    departmentCode: 'earthEdu',
    departmentCollege: EDU,
    baseUrl: 'https://earthedu.snu.ac.kr/ko/board/',
    categoryTags: {
        notice: '공지사항',
        scholarship: '장학',
        job: '취업/아르바이트',
    },
    excludedTag: '미분류',
});
