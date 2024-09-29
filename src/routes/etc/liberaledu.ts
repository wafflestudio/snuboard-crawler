// filename must equal to first level of url domain.
// e.g. liberaledu.snu.ac.kr -> liberaledu.ts

import { CategoryCrawler } from '../../classes/categoryCrawler.js';
import { ETC } from '../../constants.js';

export const liberaledu = new CategoryCrawler({
    departmentName: '기초교육원',
    departmentCode: 'liberaledu',
    departmentCollege: ETC,
    baseUrl: 'https://liberaledu.snu.ac.kr/board/',
    categoryTags: {
        notice: '공지사항',
    },
    excludedTag: '미분류',
});
