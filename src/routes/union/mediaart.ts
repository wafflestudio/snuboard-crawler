import { ArtCrawler } from '../../classes/artCrawler.js';
import { UNION } from '../../constants.js';

export const mediaart = new ArtCrawler({
    departmentName: '영상매체예술',
    departmentCode: 'mediaart',
    departmentCollege: UNION,
    departmentLink: 'http://art.snu.ac.kr/category/program-in-media-art/',
    baseUrl: 'http://art.snu.ac.kr/category/program-in-media-art',
});
