import { CategoryCrawler } from '../../classes/categoryCrawler';
import { ENGINEERING } from '../../constants';

export const cbe = new CategoryCrawler({
    departmentName: '화학생물공학부',
    departmentCode: 'cbe', // this value must be equal to the filename
    departmentCollege: ENGINEERING,
    baseUrl: 'https://cbe.snu.ac.kr/ko/board/',
    categoryTags: {
        notice: '학부&대학원',
        college2: '학부',
        postgraduate_school: '대학원',
        seminar: '세미나',
        free_board: '자유게시판',
    },
    excludedTag: '미분류',
});
