import { SOCIAL } from '../../constants.js';
import { GeogCrawler } from '../social/geog.js';

export const communication = new GeogCrawler({
    departmentName: '언론정보학과',
    departmentCode: 'communication',
    departmentCollege: SOCIAL,
    baseUrl: 'https://communication.snu.ac.kr/category/',
    categoryTags: {
        board_7_GN_13vY9brE_20201130092750: '공지사항',
    },
});
