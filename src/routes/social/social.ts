import { CategoryCrawler } from '../../classes/categoryCrawler';
import { SOCIAL } from '../../constants';

export const social = new CategoryCrawler({
    departmentName: '사회과학대학',
    departmentCode: 'social', // this value must be equal to the filename
    departmentCollege: SOCIAL,
    baseUrl: 'https://social.snu.ac.kr/board/',
    categoryTags: {
        notice: '공지사항',
    },
    excludedTag: '미분류',
});
