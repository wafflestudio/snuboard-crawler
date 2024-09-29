import { CategoryCrawler } from '../../classes/categoryCrawler.js';
import { VET } from '../../constants.js';

export const vet = new CategoryCrawler({
    departmentName: '수의과대학',
    departmentCode: 'vet', // this value must be equal to the filename
    departmentCollege: VET,
    baseUrl: 'https://vet.snu.ac.kr/board/',
    categoryTags: {
        notice: '공지사항',
    },
    excludedTag: '미분류',
});
