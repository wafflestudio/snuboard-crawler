import { Connection } from 'typeorm';
import * as cse from './cse';
import * as cbe from './cbe';

export const routeList: ((connection: Connection) => Promise<void>)[] = [cbe.startCrawl];
