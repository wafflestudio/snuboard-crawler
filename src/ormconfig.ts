import { ConnectionOptions } from 'typeorm';
import { MysqlConnectionOptions } from 'typeorm/driver/mysql/MysqlConnectionOptions';
import ormConfig from '../server/src/ormconfig';

const serverOrmConfig = <MysqlConnectionOptions>ormConfig;

const crawlerOrmConfig: ConnectionOptions = {
    type: serverOrmConfig.type,
    host: serverOrmConfig.host,
    port: serverOrmConfig.port,
    username: serverOrmConfig.username,
    password: serverOrmConfig.password,
    database: serverOrmConfig.database,
    entities: serverOrmConfig.entities,
    synchronize: serverOrmConfig.synchronize,
    migrations: ['dist/server/src/migration/*.js'],
    migrationsRun: serverOrmConfig.migrationsRun,
    cli: {
        migrationsDir: 'server/src/migration',
    },
};

export = crawlerOrmConfig;
