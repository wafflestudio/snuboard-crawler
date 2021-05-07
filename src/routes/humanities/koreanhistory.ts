import { HUMANITIES } from '../../constants';
import { CategoryCrawler } from '../../classes/categoryCrawler';

export const koreanHistory = new CategoryCrawler({
    departmentName: '국사학과',
    departmentCode: 'koreanhistory',
    departmentCollege: HUMANITIES,
    baseUrl: 'https://koreanhistory.snu.ac.kr/board/',
    categoryTags: {
        notice: '공지사항',
        event: '소식&행사',
        scholarship: '장학',
    },
    excludedTag: '미분류',
});
