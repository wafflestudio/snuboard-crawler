import { CHE } from '../../constants';
import { CategoryCrawler } from '../../classes/categoryCrawler';

export const foodNutrition = new CategoryCrawler({
    departmentName: '식품영양학과',
    departmentCode: 'foodnutrition',
    departmentCollege: CHE,
    baseUrl: 'https://foodnutrition.snu.ac.kr/ko/board/',
    categoryTags: {
        notice: '공지사항',
        notice2: '취업 및 기타',
    },
    excludedTag: '미분류',
});
