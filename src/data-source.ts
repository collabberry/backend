import { DataSource } from 'typeorm';
import { config as dotenv_config } from 'dotenv';
import { SharedEntities } from './shared-entities.js';
dotenv_config();

export const AppDataSource = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    username: process.env.DB_UNAME,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    synchronize: true,
    logging: ['error'],
    entities: SharedEntities,
    subscribers: [],
    migrations: [],
    timezone: 'Z',
    extra: {
        // Add the allowPublicKeyRetrieval option here
        allowPublicKeyRetrieval: true
    }
});
