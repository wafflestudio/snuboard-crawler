import { Connection } from 'typeorm';
import { cse } from './cse';
import { ere } from './ere';
import { ee } from './ee';
import { cbe } from './cbe';
import { me } from './me';
import { ie } from './ie';
import { math } from './math';
import { ship } from './ship';
import { cee } from './cee';
import { architecture } from './architecture';
import { mse } from './mse';

export const routeList: ((connection: Connection) => Promise<void>)[] = [
    cse.startCrawl,
    ee.startCrawl,
    cbe.startCrawl,
    ere.startCrawl,
    me.startCrawl,
    ie.startCrawl,
    ship.startCrawl,
    cee.startCrawl,
    architecture.startCrawl,
    mse.startCrawl,
    math.startCrawl,
];
