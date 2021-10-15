import { ArtCrawler } from '../../classes/artCrawler';
import { ART } from '../../constants';

export const design = new ArtCrawler({
    departmentName: '디자인과',
    departmentCode: 'design',
    departmentCollege: ART,
    departmentLink: 'http://art.snu.ac.kr/category/design/',
    baseUrl: 'http://art.snu.ac.kr/category/design',
});
