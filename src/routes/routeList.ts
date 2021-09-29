import { Connection } from 'typeorm';
import { cse } from './engineering/cse';
import { ere } from './engineering/ere';
import { ee } from './engineering/ee';
import { cbe } from './engineering/cbe';
import { me } from './engineering/me';
import { ie } from './engineering/ie';
import { math } from './science/math';
import { ship } from './engineering/ship';
import { cee } from './engineering/cee';
import { architecture } from './engineering/architecture';
import { mse } from './engineering/mse';
import { physics } from './science/physics';
import { biosci } from './science/biosci';
import { sees } from './science/sees';
import { chem } from './science/chem';
import { ir } from './social/ir';
import { snuPharm } from './pharm/snupharm';
import { vet } from './vet/vet';
import { cls } from './cls/cls';
import { social } from './social/social';
import { cals } from './cals/cals';
import { aerospace } from './engineering/aerospace';
import { humanities } from './humanities/humanities';
import { econ } from './social/econ';
import { nursing } from './nursing/nursing';
import { cba } from './cba/cba';
import { Crawler } from '../classes/crawler';
import { german } from './humanities/german';
import { koreanHistory } from './humanities/koreanhistory';
import { asianHistory } from './humanities/asianhistory';
import { wHistory } from './humanities/whistory';
import { meeHak } from './humanities/meehak';
import { chemEdu } from './edu/chemedu';
import { earthEdu } from './edu/earthedu';
import { french } from './edu/french';
import { geoEdu } from './edu/geoedu';
import { histoEdu } from './edu/histoedu';
import { korEdu } from './edu/koredu';
import { learning } from './edu/learning';
import { mathEd } from './edu/mathed';
import { physed } from './edu/physed';
import { sports } from './edu/sports';
import { che } from './che/che';
import { childFamily } from './che/childfamily';
import { clothing } from './che/clothing';
import { consumer } from './che/consumer';
import { foodNutrition } from './che/foodnutrition';
import { music } from './music/music';
import { linguist } from './humanities/linguist';
import { geog } from './social/geog';
import { stat } from './science/stat';
import { religion } from './humanities/religion';
import { philosophy } from './humanities/philosophy';
import { communication } from './social/communication';
import { archaeologyArthistory } from './humanities/archaeology-arthistory';
import { socialEdu } from './edu/socialedu';
import { ethics } from './edu/ethics';
import { engEdu } from './edu/engedu';
import { art } from './art/art';
import { asia } from './humanities/asia';
import { snuCll } from './humanities/snucll';
import { snuFrance } from './humanities/snufrance';
import { english } from './humanities/english';
import { russian } from './humanities/russian';
import { spanish } from './humanities/spanish';
import { medicine } from './medicine/medicine';
import { oia } from './etc/oia';
import { liberaledu } from './etc/liberaledu';
import { sociology } from './social/sociology';
import { TRUE_STRING } from '../constants';
import { easia } from './union/easia';
import { isc } from './union/isc';

export const earlyStopList: Crawler[] = [
    cse,
    ee,
    cbe,
    ere,
    me,
    ie,
    ship,
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
    spanish,
    medicine,
    oia,
    liberaledu,
    sociology,
    easia,
    isc,
];

const populationList = [easia, isc];

const POPULATION = TRUE_STRING.includes(process.env.POPULATION ?? '');
const crawlerList = POPULATION ? populationList : earlyStopList;

export const routeList: ((connection: Connection) => Promise<void>)[] = crawlerList.map((cr) => cr.startCrawl);
