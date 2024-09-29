import { ArtCrawler } from '../../classes/artCrawler.js';
import { ART } from '../../constants.js';

export const craft = new ArtCrawler({
    departmentName: '공예과',
    departmentCode: 'craft',
    departmentCollege: ART,
    departmentLink: 'http://art.snu.ac.kr/category/craft/',
    baseUrl: 'http://art.snu.ac.kr/category/craft',
});
