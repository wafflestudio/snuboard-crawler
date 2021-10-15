import { ArtCrawler } from '../../classes/artCrawler';
import { ART } from '../../constants';

export const orientalpainting = new ArtCrawler({
    departmentName: '동양화과',
    departmentCode: 'orientalpainting',
    departmentCollege: ART,
    departmentLink: 'http://art.snu.ac.kr/category/oriental-painting/',
    baseUrl: 'http://art.snu.ac.kr/category/oriental-painting',
});
