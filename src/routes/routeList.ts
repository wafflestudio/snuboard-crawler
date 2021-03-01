import { Connection } from 'typeorm';
import * as cse from './cse';
import * as ee from './ee';
import * as cbe from './cbe';

export const routeList: ((connection: Connection) => Promise<void>)[] = [
    cse.startCrawl, 
    ee.startCrawl, 
    cbe.startCrawl
];
