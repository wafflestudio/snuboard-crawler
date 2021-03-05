import { Connection } from 'typeorm';
import { cse } from './cse';
import { ere } from './ere';
import { ee } from './ee';
import { cbe } from './cbe';
import { me } from './me';
import { ie } from './ie';

export const routeList: ((connection: Connection) => Promise<void>)[] = [
    cse.startCrawl,
    ee.startCrawl,
    cbe.startCrawl,
    ere.startCrawl,
    me.startCrawl,
    ie.startCrawl,
];
