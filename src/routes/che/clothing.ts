import { CHE } from '../../constants';
import { CategoryCrawler } from '../../classes/categoryCrawler';

export const clothing = new CategoryCrawler({
    departmentName: '의류학과',
    departmentCode: 'clothing',
    departmentCollege: CHE,
    baseUrl: 'https://clothing.snu.ac.kr/board/',
    categoryTags: {
        notice: '공지사항',
        course_bachelor: '학사과정',
        graduate_course: '대학원과정',
        entrance_examination: '입시',
        scholarship: '장학',
        research: '연구',
        abroad: '국외',
        recruit: '채용',
    },
    excludedTag: '미분류',
});
