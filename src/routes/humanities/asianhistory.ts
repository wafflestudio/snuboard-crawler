import { CategoryCrawler } from '../../classes/categoryCrawler.js';
import { HUMANITIES } from '../../constants.js';

export const asianHistory = new CategoryCrawler({
    departmentName: '동양사학과',
    departmentCode: 'asianhistory',
    departmentCollege: HUMANITIES,
    baseUrl: 'https://asianhistory.snu.ac.kr/board/',
    categoryTags: {
        notice: '공지사항',
        free: '자유게시판',
    },
    excludedTag: '미분류',
});
