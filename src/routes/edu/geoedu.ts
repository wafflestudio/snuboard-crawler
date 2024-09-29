import { CategoryCrawler } from '../../classes/categoryCrawler.js';
import { EDU } from '../../constants.js';

export const geoEdu = new CategoryCrawler({
    departmentName: '지리교육과',
    departmentCode: 'geoedu',
    departmentCollege: EDU,
    baseUrl: 'https://geoedu.snu.ac.kr/ko/board/',
    categoryTags: {
        notice: '공지사항',
        undergraduate: '학부',
        graduate: '대학원',
        scholarship: '장학',
        teacher: '교직',
    },
    excludedTag: '미분류',
});
