import { DataSource } from 'typeorm';

import { cals } from './cals/cals.js';
import { cba } from './cba/cba.js';
import { cls } from './cls/cls.js';
import { chemEdu } from './edu/chemedu.js';
import { earthEdu } from './edu/earthedu.js';
import { french } from './edu/french.js';
import { geoEdu } from './edu/geoedu.js';
import { histoEdu } from './edu/histoedu.js';
import { korEdu } from './edu/koredu.js';
import { learning } from './edu/learning.js';
import { mathEd } from './edu/mathed.js';
import { physed } from './edu/physed.js';
import { aerospace } from './engineering/aerospace.js';
import { architecture } from './engineering/architecture.js';
import { cbe } from './engineering/cbe.js';
import { cee } from './engineering/cee.js';
import { cse } from './engineering/cse.js';
import { ee } from './engineering/ee.js';
import { ere } from './engineering/ere.js';
import { ie } from './engineering/ie.js';
import { me } from './engineering/me.js';
import { mse } from './engineering/mse.js';
import { ship } from './engineering/ship.js';
import { asianHistory } from './humanities/asianhistory.js';
import { german } from './humanities/german.js';
import { humanities } from './humanities/humanities.js';
import { koreanHistory } from './humanities/koreanhistory.js';
import { meeHak } from './humanities/meehak.js';
import { wHistory } from './humanities/whistory.js';
import { nursing } from './nursing/nursing.js';
import { snuPharm } from './pharm/snupharm.js';
import { biosci } from './science/biosci.js';
import { chem } from './science/chem.js';
import { math } from './science/math.js';
import { physics } from './science/physics.js';
import { sees } from './science/sees.js';
import { econ } from './social/econ.js';
import { ir } from './social/ir.js';
import { social } from './social/social.js';
import { vet } from './vet/vet.js';
import { Crawler } from '../classes/crawler.js';
import { TRUE_STRING } from '../constants.js';
import { art } from './art/art.js';
import { craft } from './art/craft.js';
import { design } from './art/design.js';
import { orientalpainting } from './art/orientalpainting.js';
import { painting } from './art/painting.js';
import { sculpture } from './art/sculpture.js';
import { che } from './che/che.js';
import { childFamily } from './che/childfamily.js';
import { clothing } from './che/clothing.js';
import { consumer } from './che/consumer.js';
import { foodNutrition } from './che/foodnutrition.js';
import { engEdu } from './edu/engedu.js';
import { ethics } from './edu/ethics.js';
import { socialEdu } from './edu/socialedu.js';
import { sports } from './edu/sports.js';
import { liberaledu } from './etc/liberaledu.js';
import { oia } from './etc/oia.js';
import { archaeologyArthistory } from './humanities/archaeology-arthistory.js';
import { asia } from './humanities/asia.js';
import { english } from './humanities/english.js';
import { linguist } from './humanities/linguist.js';
import { philosophy } from './humanities/philosophy.js';
import { religion } from './humanities/religion.js';
import { russian } from './humanities/russian.js';
import { snuCll } from './humanities/snucll.js';
import { snuFrance } from './humanities/snufrance.js';
import { spanish } from './humanities/spanish.js';
import { medicine } from './medicine/medicine.js';
import { music } from './music/music.js';
import { stat } from './science/stat.js';
import { communication } from './social/communication.js';
import { geog } from './social/geog.js';
import { sociology } from './social/sociology.js';
import { easia } from './union/easia.js';
import { ect } from './union/ect.js';
import { imai } from './union/imai.js';
import { isc } from './union/isc.js';
import { mediaart } from './union/mediaart.js';
import { ssai } from './union/ssai.js';

export const earlyStopList: Crawler[] = [
    // cse,
    ee,
    cbe,
    ere,
    me,
    ie,
    // ship,
    cee,
    architecture,
    mse,
    math,
    physics,
    sees,
    chem,
    ir,
    snuPharm,
    vet,
    cls,
    social,
    biosci,
    cals,
    aerospace,
    econ,
    humanities,
    nursing,
    cba,
    german,
    koreanHistory,
    asianHistory,
    wHistory,
    meeHak,
    chemEdu,
    earthEdu,
    french,
    geoEdu,
    histoEdu,
    korEdu,
    learning,
    mathEd,
    physed,
    sports,
    che,
    childFamily,
    clothing,
    consumer,
    foodNutrition,
    music,
    linguist,
    geog,
    stat,
    religion,
    philosophy,
    communication,
    archaeologyArthistory,
    socialEdu,
    ethics,
    engEdu,
    art,
    asia,
    snuCll,
    snuFrance,
    english,
    russian,
    // spanish,
    medicine,
    oia,
    liberaledu,
    sociology,
    easia,
    isc,
    ssai,
    ect,
    mediaart,
    imai,
    orientalpainting,
    painting,
    sculpture,
    craft,
    design,
];

const populationList = [orientalpainting, painting, sculpture, craft, design, sociology];

const POPULATION = TRUE_STRING.includes(process.env.POPULATION ?? '');
const crawlerList = POPULATION ? populationList : earlyStopList;

export const routeList: ((DataSource: DataSource) => Promise<void>)[] = crawlerList.map((cr) => cr.startCrawl);
