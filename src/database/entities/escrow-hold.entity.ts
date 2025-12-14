import { Entity, Index, Column, ManyToOne, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { EscrowAccountEntity } from './escrow-account.entity';
import { TournamentEntity } from './tournament.entity';

export enum HoldType {
  TOURNAMENT_PRIZE = 'tournament_prize',
  SECURITY_DEPOSIT = 'security_deposit',
  PLATFORM_FEE = 'platform_fee',
  DISPUTE_RESERVE = 'dispute_reserve',
}

export enum HoldStatus {
  ACTIVE = 'active',
  RELEASED = 'released',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

@Entity('escrow_holds')
@Index(['escrowAccountId'])
@Index(['tournamentId'])
@Index(['status'])
export class EscrowHoldEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  escrowAccountId!: string;

  @ManyToOne(() => EscrowAccountEntity, { onDelete: 'CASCADE' })
  escrowAccount!: EscrowAccountEntity;

  @Column({ type: 'uuid', nullable: true })
  tournamentId?: string;

  @ManyToOne(() => TournamentEntity, { nullable: true, onDelete: 'CASCADE' })
  tournament?: TournamentEntity;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount!: number;

  @Column({
    type: 'enum',
    enum: HoldType,
    default: HoldType.TOURNAMENT_PRIZE,
  })
  holdType!: HoldType;

  @Column({
    type: 'enum',
    enum: HoldStatus,
    default: HoldStatus.ACTIVE,
  })
  status!: HoldStatus;

  @Column({ type: 'timestamptz', nullable: true })
  releasedAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt?: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
