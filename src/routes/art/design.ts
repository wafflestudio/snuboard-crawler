import { ArtCrawler } from '../../classes/artCrawler.js';
import { ART } from '../../constants.js';

export const design = new ArtCrawler({
    departmentName: '디자인과',
    departmentCode: 'design',
    departmentCollege: ART,
    departmentLink: 'http://art.snu.ac.kr/category/design/',
    baseUrl: 'http://art.snu.ac.kr/category/design',
});
