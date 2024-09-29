import { CategoryCrawler } from '../../classes/categoryCrawler.js';
import { HUMANITIES } from '../../constants.js';

export const wHistory = new CategoryCrawler({
    departmentName: '서양사학과',
    departmentCode: 'whistory',
    departmentCollege: HUMANITIES,
    baseUrl: 'https://whistory.snu.ac.kr/board/',
    categoryTags: {
        notice: '공지사항',
        event: '소식&행사',
        scholarship: '장학',
    },
    excludedTag: '미분류',
});
