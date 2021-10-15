import { ArtCrawler } from '../../classes/artCrawler';
import { ART } from '../../constants';

export const craft = new ArtCrawler({
    departmentName: '공예과',
    departmentCode: 'craft',
    departmentCollege: ART,
    departmentLink: 'http://art.snu.ac.kr/category/craft/',
    baseUrl: 'http://art.snu.ac.kr/category/craft',
});
