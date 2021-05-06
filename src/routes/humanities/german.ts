import { HUMANITIES } from '../../constants';
import { CategoryCrawler } from '../../classes/categoryCrawler';

export const german = new CategoryCrawler({
    departmentName: '독어독문학과',
    departmentCode: 'german',
    departmentCollege: HUMANITIES,
    baseUrl: 'https://german.snu.ac.kr/ko/board/',
    categoryTags: {
        notice: '공지사항',
    },
    excludedTag: '미분류',
});
