import {Crawler} from "../classes/crawler";
import {SCIENCE} from "../constants";

class PhysicsCrawler extends Crawler{

}

export const physics = new PhysicsCrawler({
    departmentName: '물리천문학부',
    departmentCode: 'physics', // this value must be equal to the filename
    departmentCollege: SCIENCE,
    baseUrl: 'https://physics.snu.ac.kr/boards/notice',
})
