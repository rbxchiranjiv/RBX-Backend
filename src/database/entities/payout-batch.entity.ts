import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { PayoutTransactionEntity } from './payout-transaction.entity';

export type PayoutBatchStatus = 'pending' | 'processing' | 'sent' | 'failed';

@Entity({ name: 'payout_batches' })
export class PayoutBatchEntity extends BaseEntity {
  @Column({ type: 'enum', enum: ['pending', 'processing', 'sent', 'failed'], default: 'pending' })
  status!: PayoutBatchStatus;

  @Column({ type: 'bigint' })
  totalAmountCents!: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency!: string;

  @Column({ type: 'uuid' })
  createdByUser!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  user!: UserEntity;

  @OneToMany(() => PayoutTransactionEntity, transaction => transaction.batch)
  transactions!: PayoutTransactionEntity[];
}
