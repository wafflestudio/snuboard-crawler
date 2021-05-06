import { CategoryCrawler } from '../../classes/categoryCrawler';
import { EDU } from '../../constants';

export const korEdu = new CategoryCrawler({
    departmentName: '국어교육과',
    departmentCode: 'koredu',
    departmentCollege: EDU,
    baseUrl: 'https://koredu.snu.ac.kr/ko/board/',
    categoryTags: {
        banotice: '학부 공지',
        granotice: '대학원 공지',
    },
    excludedTag: '미분류',
});
