import { ArtCrawler } from '../../classes/artCrawler';
import { UNION } from '../../constants';

export const mediaart = new ArtCrawler({
    departmentName: '영상매체예술',
    departmentCode: 'mediaart',
    departmentCollege: UNION,
    departmentLink: 'http://art.snu.ac.kr/category/program-in-media-art/',
    baseUrl: 'http://art.snu.ac.kr/category/program-in-media-art',
});
