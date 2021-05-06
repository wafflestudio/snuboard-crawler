import { CategoryCrawler } from '../../classes/categoryCrawler';
import { EDU } from '../../constants';

export const chemEdu = new CategoryCrawler({
    departmentName: '화학교육과',
    departmentCode: 'chemedu',
    departmentCollege: EDU,
    baseUrl: 'https://chemedu.snu.ac.kr/board/',
    categoryTags: {
        total: '통합',
        department: '학사',
        graduate_school: '대학원',
    },
    excludedTag: '미분류',
});
