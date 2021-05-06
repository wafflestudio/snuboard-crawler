import { CategoryCrawler } from '../../classes/categoryCrawler';
import { EDU } from '../../constants';

export const physEd = new CategoryCrawler({
    departmentName: '물리교육과',
    departmentCode: 'physed',
    departmentCollege: EDU,
    baseUrl: 'https://physed.snu.ac.kr/ko/board/',
    categoryTags: {
        notice: '공지사항',
        Scholarship: '장학',
        event: '행사',
    },
    excludedTag: '미분류',
});
