// filename must equal to first level of url domain.
// e.g. ir.snu.ac.kr -> ir.ts

import { GeogCrawler } from './geog.js';
import { SOCIAL } from '../../constants.js';

export const sociology = new GeogCrawler({
    departmentName: '사회학과',
    departmentCode: 'sociology',
    departmentCollege: SOCIAL,
    baseUrl: 'https://sociology.snu.ac.kr/category/',
    departmentLink: 'https://sociology.snu.ac.kr/',
    categoryTags: {
        'undergraduate/': '학부',
        'graduate/': '대학원',
        'etc/': '기타',
    },
});
