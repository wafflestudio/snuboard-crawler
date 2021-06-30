import { SocialEduCrawler } from './socialedu';
import { EDU } from '../../constants';

export const engEdu = new SocialEduCrawler({
    departmentName: '영어교육과',
    departmentCode: 'engedu', // this value must be equal to the filename
    departmentCollege: EDU,
    baseUrl: 'http://engedu.snu.ac.kr/05_sub/',
    categoryTags: {
        '5c_sub01.php?page=1': '학부',
        '5c_sub02.php?page=1': '대학원',
    },
});
