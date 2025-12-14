import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { EscrowAccountEntity } from './escrow-account.entity';
import { PaymentRecordEntity } from './payment-record.entity';
import { MatchEntity } from './match.entity';

export type LedgerEntryKind = 'deposit' | 'hold' | 'release' | 'payout' | 'refund' | 'fee' | 'rollback';

@Entity({ name: 'ledger_entries' })
export class LedgerEntryEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  escrowAccountId!: string;

  @Column({ type: 'enum', enum: ['deposit', 'hold', 'release', 'payout', 'refund', 'fee', 'rollback'] })
  kind!: LedgerEntryKind;

  @Column({ type: 'bigint' })
  amountCents!: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency!: string;

  @Column({ type: 'uuid', nullable: true })
  relatedPaymentId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  relatedMatchId?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @ManyToOne(() => EscrowAccountEntity, { onDelete: 'CASCADE' })
  escrowAccount!: EscrowAccountEntity;

  @ManyToOne(() => PaymentRecordEntity, { nullable: true, onDelete: 'SET NULL' })
  relatedPayment?: PaymentRecordEntity | null;

  @ManyToOne(() => MatchEntity, { nullable: true, onDelete: 'SET NULL' })
  relatedMatch?: MatchEntity | null;
}
