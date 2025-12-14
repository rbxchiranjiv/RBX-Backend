import { DataSource, DataSourceOptions } from 'typeorm';

const ormConfig: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: false,
  logging: false,
  entities: [],
  migrations: ['dist/migrations/*.js'],
  migrationsTableName: 'typeorm_migrations',
};

export const AppDataSource = new DataSource(ormConfig);
export default ormConfig;
