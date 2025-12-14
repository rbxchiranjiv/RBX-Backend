import { Entity, Index, Column, ManyToOne, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { WalletEntity } from './wallet.entity';

export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  TRANSFER_IN = 'transfer_in',
  TRANSFER_OUT = 'transfer_out',
  HOLD = 'hold',
  RELEASE = 'release',
  FEE = 'fee',
  REFUND = 'refund',
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum ReferenceType {
  PAYMENT = 'payment',
  TOURNAMENT = 'tournament',
  ESCROW_HOLD = 'escrow_hold',
  TRANSFER = 'transfer',
  REFUND = 'refund',
  FEE = 'fee',
}

@Entity('wallet_transactions')
@Index(['walletId'])
@Index(['type'])
@Index(['referenceId', 'referenceType'])
@Index(['createdAt'])
export class WalletTransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  walletId!: string;

  @ManyToOne(() => WalletEntity, { onDelete: 'CASCADE' })
  wallet!: WalletEntity;

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  type!: TransactionType;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  balanceBefore!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  balanceAfter!: number;

  @Column({ type: 'uuid', nullable: true })
  referenceId?: string;

  @Column({
    type: 'enum',
    enum: ReferenceType,
    nullable: true,
  })
  referenceType?: ReferenceType;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.COMPLETED,
  })
  status!: TransactionStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
