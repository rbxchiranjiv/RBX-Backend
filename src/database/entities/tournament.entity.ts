import { Column, Entity, Index, JoinTable, ManyToMany, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { TeamEntity } from './team.entity';
import { RegistrationEntity } from './registration.entity';
import { MatchEntity } from './match.entity';
import { PaymentRecordEntity } from './payment-record.entity';
import { NotificationEntity } from './notification.entity';

export type TournamentMode = 'BR' | 'CS';
export type TournamentStatus =
  | 'draft'
  | 'published'
  | 'open'
  | 'readyForScheduling'
  | 'scheduled'
  | 'ongoing'
  | 'completed'
  | 'cancelled';

@Entity({ name: 'tournaments' })
@Index(['slug'], { unique: true })
export class TournamentEntity extends BaseEntity {
  @Column({ length: 120 })
  name!: string;

  @Column({ length: 60, unique: true })
  slug!: string;

  @Column({ type: 'enum', enum: ['BR', 'CS'] })
  mode!: TournamentMode;

  @Column({
    type: 'enum',
    enum: ['draft', 'published', 'open', 'readyForScheduling', 'scheduled', 'ongoing', 'completed', 'cancelled'],
    default: 'draft',
  })
  status!: TournamentStatus;

  @Column({ type: 'int', default: 0 })
  entryFee!: number;

  @Column({ type: 'int', default: 0 })
  creationFee!: number;

  @Column({ type: 'int', default: 0 })
  prizePool!: number;

  @Column({ type: 'int', default: 0 })
  maxTeams!: number;

  @Column({ type: 'boolean', default: false })
  isVersus!: boolean;

  @Column({ type: 'boolean', default: false })
  invitesEnabled!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  registrationOpensAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  registrationClosesAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  startsAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  endsAt?: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @Column({ type: 'int', default: 0 })
  freeReshufflesRemaining!: number;

  @Column({ type: 'int', default: 0 })
  paidReshufflesUsed!: number;

  @Column({ type: 'int', default: 0 })
  totalReshuffles!: number;

  @ManyToOne(() => UserEntity, (user: UserEntity) => user.tournamentsOrganized, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  organizer!: UserEntity;

  @OneToMany(() => RegistrationEntity, (registration: RegistrationEntity) => registration.tournament)
  registrations!: RegistrationEntity[];

  @OneToMany(() => MatchEntity, (match: MatchEntity) => match.tournament)
  matches!: MatchEntity[];

  @OneToMany(() => PaymentRecordEntity, (payment: PaymentRecordEntity) => payment.tournament)
  payments!: PaymentRecordEntity[];

  @OneToMany(() => NotificationEntity, (notification: NotificationEntity) => notification.tournament)
  notifications!: NotificationEntity[];

  @ManyToMany(() => TeamEntity, (team: TeamEntity) => team.invitedTo)
  @JoinTable({
    name: 'tournament_invites',
    joinColumn: { name: 'tournament_id' },
    inverseJoinColumn: { name: 'team_id' },
  })
  invitedTeams!: TeamEntity[];
}
