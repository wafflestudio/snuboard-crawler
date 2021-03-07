import { CategoryCrawler } from '../classes/categoryCrawler';
import { ENGINEERING } from '../constants';

export const ere = new CategoryCrawler({
    departmentName: '에너지자원공학과',
    departmentCode: 'ere', // this value must be equal to the filename
    baseUrl: 'https://ere.snu.ac.kr/ko/board/',
    departmentCollege: ENGINEERING,
    categoryTags: {
        notice: '공지사항',
        degree: '대학원',
        story: '홍보',
        event: '행사 및 소식',
        newsletter: '뉴스레터',
        smart: '스마트자원개발',
    },
    excludedTag: '미분류',
});
