import { Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { TournamentEntity } from './tournament.entity';
import { RegistrationEntity } from './registration.entity';

export type PaymentDirection = 'credit' | 'debit';

export const PaymentStatus = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  REFUNDED: 'refunded',
} as const;

export type PaymentStatus = typeof PaymentStatus[keyof typeof PaymentStatus];

export const SettlementStatus = {
  PENDING: 'pending',
  SETTLED: 'settled',
  FAILED: 'failed',
  REVERSED: 'reversed',
} as const;

export type SettlementStatus = typeof SettlementStatus[keyof typeof SettlementStatus];

@Entity({ name: 'payment_records' })
export class PaymentRecordEntity extends BaseEntity {
  @Column({ type: 'enum', enum: ['credit', 'debit'] })
  direction!: PaymentDirection;

  @Column({ type: 'int' })
  amount!: number;

  @Column({ length: 8, default: 'INR' })
  currency!: string;

  @Column({ length: 40 })
  gateway!: string;

  @Column({ length: 80, unique: true })
  referenceId!: string;

  @Column({ type: 'enum', enum: ['pending', 'success', 'failed', 'refunded'], default: 'pending' })
  status!: PaymentStatus;

  @Column({ type: 'boolean', default: false })
  escrowHold!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt?: Date | null;

  @Column({ type: 'enum', enum: ['pending', 'settled', 'failed', 'reversed'], nullable: true })
  settlementStatus?: SettlementStatus | null;

  @Column({ type: 'jsonb', nullable: true })
  gatewayResponse?: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  gatewayEventId?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @ManyToOne(() => UserEntity, (user: UserEntity) => user.payments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  user!: UserEntity;

  @ManyToOne(() => TournamentEntity, (tournament: TournamentEntity) => tournament.payments, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  tournament?: TournamentEntity | null;

  @Column({ type: 'uuid', nullable: true })
  walletId?: string | null;

  @Column({ type: 'uuid', nullable: true })
  walletTransactionId?: string | null;

  @Column({ type: 'boolean', default: false })
  autoWalletDeposit!: boolean;

  @ManyToOne(() => RegistrationEntity, (registration: RegistrationEntity) => registration.paymentRecords, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  registration?: RegistrationEntity | null;
}
