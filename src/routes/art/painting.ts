import { ArtCrawler } from '../../classes/artCrawler.js';
import { ART } from '../../constants.js';

export const painting = new ArtCrawler({
    departmentName: '서양화과',
    departmentCode: 'painting',
    departmentCollege: ART,
    departmentLink: 'http://art.snu.ac.kr/category/painting/',
    baseUrl: 'http://art.snu.ac.kr/category/painting',
});
