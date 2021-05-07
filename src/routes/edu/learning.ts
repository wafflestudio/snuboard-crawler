import { CategoryCrawler } from '../../classes/categoryCrawler';
import { EDU } from '../../constants';

export const learning = new CategoryCrawler({
    departmentName: '교육학과',
    departmentCode: 'learning',
    departmentCollege: EDU,
    baseUrl: 'https://learning.snu.ac.kr/board/',
    categoryTags: {
        notice: '공지사항',
        news: '학과뉴스',
        free_ug: '학부게시판',
        free_grad: '대학원게시판',
    },
    excludedTag: '미분류',
});
