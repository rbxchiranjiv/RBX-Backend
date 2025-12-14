import { Column, Entity, Index, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { TournamentEntity } from './tournament.entity';
import { TeamEntity } from './team.entity';
import { UserEntity } from './user.entity';
import { PaymentRecordEntity } from './payment-record.entity';

export type RegistrationStatus = 'pending' | 'confirmed' | 'waitlisted' | 'cancelled';
export type RegistrationPaymentStatus = 'pending' | 'paid' | 'refunded';

@Entity({ name: 'registrations' })
@Index(['tournament', 'team'], { unique: true })
export class RegistrationEntity extends BaseEntity {
  @Column({ type: 'enum', enum: ['pending', 'confirmed', 'waitlisted', 'cancelled'], default: 'pending' })
  status!: RegistrationStatus;

  @Column({ type: 'enum', enum: ['pending', 'paid', 'refunded'], default: 'pending' })
  paymentStatus!: RegistrationPaymentStatus;

  @Column({ type: 'int', default: 0 })
  amountPaid!: number;

  @Column({ type: 'boolean', default: false })
  invitedSlot!: boolean;

  @Column({ type: 'int', default: 0 })
  reshufflesUsed!: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @Column({ type: 'uuid', nullable: true })
  teamId?: string;

  @Column({ type: 'uuid', nullable: true })
  playerId?: string;

  @ManyToOne(() => TournamentEntity, (tournament: TournamentEntity) => tournament.registrations, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  tournament!: TournamentEntity;

  @ManyToOne(() => TeamEntity, (team: TeamEntity) => team.registrations, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  team!: TeamEntity;

  @ManyToOne(() => UserEntity, (user: UserEntity) => user.registrations, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  player?: UserEntity;

  @OneToMany(() => PaymentRecordEntity, (payment: PaymentRecordEntity) => payment.registration)
  paymentRecords!: PaymentRecordEntity[];
}
