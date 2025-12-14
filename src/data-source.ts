import 'dotenv/config';
import { DataSource } from 'typeorm';
import {
  UserEntity,
  TeamEntity,
  TournamentEntity,
  RegistrationEntity,
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
  StandingEntity,
  LeaderboardSnapshotEntity,
  SeasonStatsEntity,
  OrganizerStatsEntity,
  StreamSessionEntity,
  RecordingEntity,
  HighlightEntity,
  CdnUploadEntity,
  StreamWebhookEntity,
  WalletEntity,
  WalletTransactionEntity,
  EscrowHoldEntity,
} from './database/entities';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not defined. Please set it in your environment.');
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: databaseUrl,
  synchronize: false,
  logging: false,
  entities: [
    UserEntity,
    TeamEntity,
    TournamentEntity,
    RegistrationEntity,
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
    StandingEntity,
    LeaderboardSnapshotEntity,
    SeasonStatsEntity,
    OrganizerStatsEntity,
    StreamSessionEntity,
    RecordingEntity,
    HighlightEntity,
    CdnUploadEntity,
    StreamWebhookEntity,
    WalletEntity,
    WalletTransactionEntity,
    EscrowHoldEntity,
  ],
  migrations: ['src/migrations/*.ts'],
});

export default AppDataSource;
