import { CategoryCrawler } from '../../classes/categoryCrawler.js';
import { ENGINEERING } from '../../constants.js';

export const me = new CategoryCrawler({
    departmentName: '기계공학부',
    departmentCode: 'me', // this value must be equal to the filename
    baseUrl: 'https://me.snu.ac.kr/ko/board/',
    departmentCollege: ENGINEERING,
    categoryTags: {
        notice: '공지사항',
        news: '뉴스 및 이벤트',
        freeboard: '자유게시판',
        seminar: '세미나',
        jobs: '취업정보',
    },
    excludedTag: '미분류',
});
