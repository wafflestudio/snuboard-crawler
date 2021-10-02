import { GeogCrawler } from '../social/geog';
import { UNION } from '../../constants';

export const imai = new GeogCrawler({
    departmentName: '연합전공 인공지능',
    departmentCode: 'imai',
    departmentCollege: UNION,
    baseUrl: 'https://imai.snu.ac.kr/category/',
    categoryTags: {
        'board-21-GN-n5xFXM59-20210303165043': '공지사항',
        'board-56-gn-q3mqeb67-20210609110003': '소식/행사',
    },
    excludedTags: ['3', '6'],
});
