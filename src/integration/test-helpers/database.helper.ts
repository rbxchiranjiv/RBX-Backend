import { DataSource, DataSourceOptions } from 'typeorm';
import { StreamSessionEntity } from '../../database/entities/stream-session.entity';
import { RecordingEntity } from '../../database/entities/recording.entity';
import { HighlightEntity } from '../../database/entities/highlight.entity';
import { CdnUploadEntity } from '../../database/entities/cdn-upload.entity';
import { StreamWebhookEntity } from '../../database/entities/stream-webhook.entity';
import { TournamentEntity } from '../../database/entities/tournament.entity';
import { MatchEntity } from '../../database/entities/match.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { PaymentRecordEntity } from '../../database/entities/payment-record.entity';
import { EscrowAccountEntity } from '../../database/entities/escrow-account.entity';
import { LedgerEntryEntity } from '../../database/entities/ledger-entry.entity';
import { WebhookEventEntity } from '../../database/entities/webhook-event.entity';
import { PayoutBatchEntity } from '../../database/entities/payout-batch.entity';
import { PayoutTransactionEntity } from '../../database/entities/payout-transaction.entity';

export async function createTestDatabase(): Promise<DataSource> {
  const options: DataSourceOptions = {
    type: 'sqlite',
    database: ':memory:',
    entities: [
      StreamSessionEntity,
      RecordingEntity,
      HighlightEntity,
      CdnUploadEntity,
      StreamWebhookEntity,
      TournamentEntity,
      MatchEntity,
      UserEntity,
      PaymentRecordEntity,
      EscrowAccountEntity,
      LedgerEntryEntity,
      WebhookEventEntity,
      PayoutBatchEntity,
      PayoutTransactionEntity,
    ],
    synchronize: true,
    logging: false,
  };

  const dataSource = new DataSource(options);
  await dataSource.initialize();
  return dataSource;
}

export async function cleanupTestDatabase(dataSource: DataSource): Promise<void> {
  if (dataSource.isInitialized) {
    await dataSource.destroy();
  }
}
