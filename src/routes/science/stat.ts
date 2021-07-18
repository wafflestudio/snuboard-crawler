import { GeogCrawler } from '../social/geog';
import { SCIENCE } from '../../constants';

export const stat = new GeogCrawler({
    departmentName: '통계학과',
    departmentCode: 'stat',
    departmentCollege: SCIENCE,
    baseUrl: 'https://stat.snu.ac.kr/category/',
    categoryTags: {
        'board-18-gn-969abdbt-20210204013659': '공지사항',
        'board-18-GN-4n79A6rb-20210204014612': '취업정보',
    },
    excludedTags: ['3', '6'],
});
