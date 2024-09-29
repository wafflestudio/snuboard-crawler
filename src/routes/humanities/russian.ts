import { HUMANITIES } from '../../constants.js';
import { GeogCrawler } from '../social/geog.js';

export const russian = new GeogCrawler({
    departmentName: '노어노문학과',
    departmentCode: 'russian',
    departmentCollege: HUMANITIES,
    baseUrl: 'https://russian.snu.ac.kr/category/',
    categoryTags: {
        board_3_GN_44WyCJtw_20201202131822: '공지사항',
        'board-31-GN-0Cph9vw0-20210222203607': '장학',
        'board-31-GN-1306Xk6x-20210222203800': '채용/행사',
        'board-31-GN-gm2v0p43-20210323172210': '코로나19',
    },
    excludedTags: ['3', '6'],
});
