import { GeogCrawler } from '../social/geog';
import { HUMANITIES } from '../../constants';

export const english = new GeogCrawler({
    departmentName: '영어영문학과',
    departmentCode: 'english',
    departmentCollege: HUMANITIES,
    baseUrl: 'https://english.snu.ac.kr/category/',
    categoryTags: {
        board_10_GN_9Fb7DO6t_20201130130441: '공지사항',
        board_10_GN_NjxGZJcf_20201130130424: '행사',
    },
    excludedTags: ['3', '6'],
});
