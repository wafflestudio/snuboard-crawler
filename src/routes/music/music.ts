import { CategoryCrawler } from '../../classes/categoryCrawler';
import { MUSIC } from '../../constants';

export const music = new CategoryCrawler({
    departmentName: '음악대학',
    departmentCode: 'music',
    departmentCollege: MUSIC,
    baseUrl: 'https://music.snu.ac.kr/board/',
    categoryTags: {
        general: '공지사항',
        admission: '입학',
        bachelor: '학사',
        scholarship: '장학',
        general2: '일반',
        recruit: '채용',
    },
    excludedTag: '미분류',
});
