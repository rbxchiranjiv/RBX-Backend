import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { PayoutBatchEntity } from './payout-batch.entity';

export type PayoutTransactionStatus = 'pending' | 'processing' | 'sent' | 'failed';

@Entity({ name: 'payout_transactions' })
export class PayoutTransactionEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  batchId!: string;

  @Column({ type: 'text' })
  toAccountIdentifier!: string;

  @Column({ type: 'bigint' })
  amountCents!: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency!: string;

  @Column({ type: 'enum', enum: ['pending', 'processing', 'sent', 'failed'], default: 'pending' })
  status!: PayoutTransactionStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  gatewayReference?: string | null;

  @Column({ type: 'text', nullable: true })
  failureReason?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @ManyToOne(() => PayoutBatchEntity, { onDelete: 'CASCADE' })
  batch!: PayoutBatchEntity;
}
