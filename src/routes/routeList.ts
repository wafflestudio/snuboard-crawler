import { Connection } from 'typeorm';
import * as cse from './cse';

export const routeList: ((connection: Connection) => Promise<void>)[] = [cse.startCrawl];
