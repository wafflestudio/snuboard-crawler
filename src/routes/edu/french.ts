import { CategoryCrawler } from '../../classes/categoryCrawler';
import { EDU } from '../../constants';

export const french = new CategoryCrawler({
    departmentName: '불어교육과',
    departmentCode: 'french',
    departmentCollege: EDU,
    baseUrl: 'https://french.snu.ac.kr/board/',
    categoryTags: {
        notice: '학부 공지',
        notice2: '대학원 공지',
    },
    excludedTag: '미분류',
});
