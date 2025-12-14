import { Entity, Index, Column, ManyToOne, OneToMany, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { UserEntity } from './user.entity';
import { WalletTransactionEntity } from './wallet-transaction.entity';

export enum WalletStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  FROZEN = 'frozen',
  SUSPENDED = 'suspended',
}

export enum WalletCurrency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  INR = 'INR',
}

@Entity('wallets')
@Index(['userId'])
@Index(['userId', 'currency'], { unique: true })
@Index(['status'])
export class WalletEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  user!: UserEntity;

  @Column({
    type: 'enum',
    enum: WalletCurrency,
    default: WalletCurrency.USD,
  })
  currency!: WalletCurrency;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  balance!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  lockedBalance!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  availableBalance!: number;

  @Column({
    type: 'enum',
    enum: WalletStatus,
    default: WalletStatus.ACTIVE,
  })
  status!: WalletStatus;

  @OneToMany(() => WalletTransactionEntity, (transaction) => transaction.wallet)
  transactions!: WalletTransactionEntity[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
