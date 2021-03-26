import { CategoryCrawler } from '../../classes/categoryCrawler';
import { CLS } from '../../constants';

export const cls = new CategoryCrawler({
    departmentName: '자유전공학부',
    departmentCode: 'cls', // this value must be equal to the filename
    departmentCollege: CLS,
    baseUrl: 'https://cls.snu.ac.kr/board/',
    categoryTags: {
        notice: '공지사항',
    },
    excludedTag: '미분류',
});
