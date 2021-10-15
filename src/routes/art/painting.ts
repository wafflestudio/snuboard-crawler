import { ArtCrawler } from '../../classes/artCrawler';
import { ART } from '../../constants';

export const painting = new ArtCrawler({
    departmentName: '서양화과',
    departmentCode: 'painting',
    departmentCollege: ART,
    departmentLink: 'http://art.snu.ac.kr/category/painting/',
    baseUrl: 'http://art.snu.ac.kr/category/painting',
});
