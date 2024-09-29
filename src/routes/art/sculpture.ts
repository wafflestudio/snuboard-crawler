import { ArtCrawler } from '../../classes/artCrawler.js';
import { ART } from '../../constants.js';

export const sculpture = new ArtCrawler({
    departmentName: '조소과',
    departmentCode: 'sculpture',
    departmentCollege: ART,
    departmentLink: 'http://art.snu.ac.kr/category/sculpture/',
    baseUrl: 'http://art.snu.ac.kr/category/sculpture',
});
