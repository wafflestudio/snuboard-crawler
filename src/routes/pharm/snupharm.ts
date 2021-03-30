import { CategoryCrawler } from '../../classes/categoryCrawler';
import { PHARM } from '../../constants';

export const snuPharm = new CategoryCrawler({
    departmentName: '약학대학',
    departmentCode: 'snupharm', // this value must be equal to the filename
    departmentCollege: PHARM,
    baseUrl: 'https://snupharm.snu.ac.kr/ko/board/',
    categoryTags: {
        notice: '공지사항',
    },
    excludedTag: '미분류',
});
