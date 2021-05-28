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
import { geog } from './social/geog';
import { stat } from './science/stat';
import { medicine } from './medicine/medicine';

export const crawlerList: Crawler[] = [
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
    // math,
    physics,
    sees,
    // chem,
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
    geog,
    stat,
    medicine,
];
export const routeList: ((connection: Connection) => Promise<void>)[] = crawlerList.map((cr) => cr.startCrawl);
