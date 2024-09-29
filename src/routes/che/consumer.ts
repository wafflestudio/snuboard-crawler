import { CategoryCrawler } from '../../classes/categoryCrawler.js';
import { CHE } from '../../constants.js';

export const consumer = new CategoryCrawler({
    departmentName: '소비자학과',
    departmentCode: 'consumer',
    departmentCollege: CHE,
    baseUrl: 'https://consumer.snu.ac.kr/board/',
    categoryTags: {
        notice: '학사일반',
        scholarship: '장학',
        job: '취업',
        graduate: '대학원',
    },
    excludedTag: '미분류',
});
