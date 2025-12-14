import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';

@Entity({ name: 'escrow_accounts' })
export class EscrowAccountEntity extends BaseEntity {
  @Column({ type: 'uuid', nullable: true })
  ownerUserId?: string | null;

  @Column({ type: 'bigint', default: 0 })
  balanceCents!: number;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency!: string;

  @Column({ type: 'bigint', default: 0 })
  lockedCents!: number;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  ownerUser?: UserEntity | null;
}
