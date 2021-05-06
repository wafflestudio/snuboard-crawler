import { CategoryCrawler } from '../../classes/categoryCrawler';
import { EDU } from '../../constants';

export const sports = new CategoryCrawler({
    departmentName: '체육교육과',
    departmentCode: 'sports',
    departmentCollege: EDU,
    baseUrl: 'https://sports.snu.ac.kr/ko/board/',
    categoryTags: {
        notice_scholarship: '학부-장학',
        notice_student: '학부-학생',
        notice_admission: '대학원-입학',
    },
    excludedTag: '미분류',
});

export const sportsAffair = new CategoryCrawler({
    departmentName: '체육교육과',
    departmentCode: 'sports_affair',
    departmentCollege: EDU,
    baseUrl: 'https://sports.snu.ac.kr/ko/board/notice_school%20',
    categoryTags: {
        affairs: '학부-교무',
    },
    excludedTag: '미분류',
});
