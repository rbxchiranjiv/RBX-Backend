import { Column, Entity, ManyToMany, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { TournamentEntity } from './tournament.entity';
import { TeamEntity } from './team.entity';
import { PaymentRecordEntity } from './payment-record.entity';
import { NotificationEntity } from './notification.entity';
import { RefreshTokenEntity } from './refresh-token.entity';
import { MatchProofEntity } from './match-proof.entity';
import { MatchDisputeEntity } from './match-dispute.entity';
import { RegistrationEntity } from './registration.entity';

export const UserRole = {
  PLAYER: 'player',
  ORGANIZER: 'organizer',
  ADMIN: 'admin',
} as const;

export type UserRole = typeof UserRole[keyof typeof UserRole];

export const UserStatus = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  DELETED: 'deleted',
} as const;

export type UserStatus = typeof UserStatus[keyof typeof UserStatus];

@Entity({ name: 'users' })
export class UserEntity extends BaseEntity {
  @Column({ length: 80 })
  displayName!: string;

  @Column({ length: 20, unique: true })
  phoneNumber!: string;

  @Column({ length: 120, unique: true })
  email!: string;

  @Column({ length: 255, select: false })
  passwordHash!: string;

  @Column({ length: 255, nullable: true, select: false })
  passwordResetToken?: string | null;

  @Column({ type: 'timestamptz', nullable: true, select: false })
  passwordResetExpiresAt?: Date | null;

  @Column({ type: 'enum', enum: [UserRole.PLAYER, UserRole.ORGANIZER, UserRole.ADMIN], default: UserRole.PLAYER })
  role!: UserRole;

  @Column({ length: 8, nullable: true })
  countryCode?: string | null;

  @Column({ length: 120, nullable: true })
  deviceId?: string | null;

  @Column({ length: 128, nullable: true })
  timezone?: string | null;

  @Column({ length: 255, nullable: true })
  avatarUrl?: string | null;

  @Column({ default: false })
  isEmailVerified!: boolean;

  @Column({ default: false })
  isPhoneVerified!: boolean;

  @Column({ default: false })
  kycVerified!: boolean;

  @Column({ default: false })
  marketingOptIn!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt?: Date | null;

  @Column({ type: 'enum', enum: [UserStatus.ACTIVE, UserStatus.SUSPENDED, UserStatus.DELETED], default: UserStatus.ACTIVE })
  status!: UserStatus;

  @Column({ default: false })
  isOrganizerVerified!: boolean;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  preferences!: Record<string, unknown>;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @OneToMany(() => TournamentEntity, (tournament: TournamentEntity) => tournament.organizer)
  tournamentsOrganized!: TournamentEntity[];

  @OneToMany(() => TeamEntity, (team: TeamEntity) => team.owner)
  teamsOwned!: TeamEntity[];

  @ManyToMany(() => TeamEntity, (team: TeamEntity) => team.members)
  teamMemberships!: TeamEntity[];

  @OneToMany(() => PaymentRecordEntity, (payment: PaymentRecordEntity) => payment.user)
  payments!: PaymentRecordEntity[];

  @OneToMany(() => NotificationEntity, (notification: NotificationEntity) => notification.user)
  notifications!: NotificationEntity[];

  @OneToMany(() => RefreshTokenEntity, (token: RefreshTokenEntity) => token.user)
  refreshTokens!: RefreshTokenEntity[];

  @OneToMany(() => MatchProofEntity, proof => proof.uploader)
  matchProofs!: MatchProofEntity[];

  @OneToMany(() => MatchDisputeEntity, (dispute: MatchDisputeEntity) => dispute.complainantUser)
  matchDisputesFiled!: MatchDisputeEntity[];

  @OneToMany(() => MatchDisputeEntity, (dispute: MatchDisputeEntity) => dispute.resolvedBy)
  matchDisputesResolved!: MatchDisputeEntity[];

  @OneToMany(() => RegistrationEntity, (registration: RegistrationEntity) => registration.player)
  registrations!: RegistrationEntity[];
}
