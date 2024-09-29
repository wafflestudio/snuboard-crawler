import { CategoryCrawler } from '../../classes/categoryCrawler.js';
import { UNION } from '../../constants.js';

export const ssai = new CategoryCrawler({
    departmentName: '인공지능반도체공학',
    departmentCode: 'ssai',
    departmentCollege: UNION,
    baseUrl: 'https://ssai.snu.ac.kr/ko/board/',
    categoryTags: {
        notice: '공지사항',
        event: '행사',
    },
    excludedTag: '미분류',
});
