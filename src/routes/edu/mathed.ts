import { CategoryCrawler } from '../../classes/categoryCrawler';
import { EDU } from '../../constants';

export const mathEd = new CategoryCrawler({
    departmentName: '수학교육과',
    departmentCode: 'mathed',
    departmentCollege: EDU,
    baseUrl: 'https://mathed.snu.ac.kr/board/',
    categoryTags: {
        notice: '공지사항',
        career: '진로정보',
    },
    excludedTag: '미분류',
});
