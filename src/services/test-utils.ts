import 'reflect-metadata';
import { ColumnType, DataSource, getMetadataArgsStorage } from 'typeorm';
import { newDb } from 'pg-mem';
import { randomUUID } from 'crypto';
import {
  MatchEntity,
  MatchProofEntity,
  MatchDisputeEntity,
  NotificationEntity,
  PaymentRecordEntity,
  RefreshTokenEntity,
  RegistrationEntity,
  StandingEntity,
  SeasonStatsEntity,
  LeaderboardSnapshotEntity,
  TeamEntity,
  TournamentEntity,
  UserEntity,
  EscrowAccountEntity,
  LedgerEntryEntity,
  WebhookEventEntity,
  PayoutBatchEntity,
  PayoutTransactionEntity,
} from '../database/entities';

function patchColumnDesignTypes() {
  const storage = getMetadataArgsStorage();
  const matchRoomColumn = storage.columns.find(
    column => typeof column.target === 'function' && column.target.name === 'MatchEntity' && column.propertyName === 'roomId',
  );

  if (matchRoomColumn) {
    const prototype = (matchRoomColumn.target as Function).prototype;
    const currentType = Reflect.getMetadata('design:type', prototype, matchRoomColumn.propertyName);
    console.debug('MatchEntity.roomId before patch', {
      optionsType: matchRoomColumn.options.type,
      designType: currentType?.name ?? currentType,
    });
  } else {
    console.debug('MatchEntity.roomId column metadata not found');
  }

  storage.columns.forEach(column => {
    if (typeof column.target === 'function') {
      const prototype = column.target.prototype;
      const currentType = Reflect.getMetadata('design:type', prototype, column.propertyName);
      const forceType = () => {
        column.options.type = 'varchar' as ColumnType;
        Reflect.defineMetadata('design:type', String, prototype, column.propertyName);
      };

      if (column.options.type && typeof column.options.type === 'function') {
        const ctor = column.options.type as Function;
        if (ctor === Object) {
          forceType();
        }
      }

      if (currentType === Object && !column.options.type) {
        forceType();
      }
    }
  });
}

patchColumnDesignTypes();

export async function createTestDataSource(): Promise<DataSource> {
  const db = newDb({ autoCreateForeignKeyIndices: true });
  db.public.registerFunction({ name: 'current_database', returns: 'text' as any, implementation: () => 'test' });
  db.public.registerFunction({ name: 'version', returns: 'text' as any, implementation: () => 'pg-mem' });
  db.public.registerFunction({ name: 'gen_random_uuid', returns: 'uuid' as any, implementation: randomUUID, impure: true });
  db.public.registerFunction({ name: 'uuid_generate_v4', returns: 'uuid' as any, implementation: randomUUID, impure: true });

  const entityClasses = [
    UserEntity,
    TeamEntity,
    TournamentEntity,
    RegistrationEntity,
    StandingEntity,
    SeasonStatsEntity,
    LeaderboardSnapshotEntity,
    MatchEntity,
    MatchProofEntity,
    MatchDisputeEntity,
    PaymentRecordEntity,
    NotificationEntity,
    RefreshTokenEntity,
    EscrowAccountEntity,
    LedgerEntryEntity,
    WebhookEventEntity,
    PayoutBatchEntity,
    PayoutTransactionEntity,
  ];

  console.debug('Test entities:', entityClasses.map(e => e.name));

  const dataSource = await db.adapters.createTypeormDataSource({
    type: 'postgres',
    entities: entityClasses,
    synchronize: true,
    logging: false,
  });

  await dataSource.initialize();
  return dataSource;
}

export async function destroyTestDataSource(dataSource?: DataSource) {
  if (dataSource && dataSource.isInitialized) {
    await dataSource.destroy();
  }
}
