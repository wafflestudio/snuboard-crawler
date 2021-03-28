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
import { snuPharm } from './pharm/snupharm';
import { vet } from './vet/vet';
import { cls } from './cls/cls';
import { social } from './social/social';
import { Crawler } from '../classes/crawler';

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
    math,
    physics,
    biosci,
    sees,
    snuPharm,
    vet,
    cls,
    social,
];

export const routeList: ((connection: Connection) => Promise<void>)[] = crawlerList.map((cr) => cr.startCrawl);
