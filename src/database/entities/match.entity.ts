import { Column, Entity, JoinTable, ManyToMany, ManyToOne, OneToMany, VersionColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { TournamentEntity } from './tournament.entity';
import { TeamEntity } from './team.entity';
import { NotificationEntity } from './notification.entity';
import { MatchProofEntity } from './match-proof.entity';
import { MatchDisputeEntity } from './match-dispute.entity';

export type MatchStatus =
  | 'scheduled'
  | 'ongoing'
  | 'ended'
  | 'disputed'
  | 'resolving'
  | 'result_confirmed'
  | 'cancelled';

@Entity({ name: 'matches' })
export class MatchEntity extends BaseEntity {
  @Column({ length: 40, unique: true })
  code!: string;

  @Column({ type: 'enum', enum: ['BR', 'CS'] })
  mode!: 'BR' | 'CS';

  @Column({
    type: 'enum',
    enum: ['scheduled', 'ongoing', 'ended', 'disputed', 'resolving', 'result_confirmed', 'cancelled'],
    default: 'scheduled',
  })
  status!: MatchStatus;

  @Column({ type: 'int', default: 1 })
  roundNumber!: number;

  @Column({ type: 'int', default: 0 })
  reshuffleCount!: number;

  @Column({ type: 'timestamptz', nullable: true })
  scheduledAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  endedAt?: Date | null;

  @Column({ type: 'int', nullable: true })
  qualifierNumber?: number | null;

  @Column({ length: 40, nullable: true })
  roomId?: string | null;

  @Column({ length: 40, nullable: true })
  roomPassword?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  resultMetadata?: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  results?: Array<{
    teamId: string;
    playerId?: string;
    placement: number;
    stats: Record<string, any>;
  }> | null;

  @ManyToOne(() => TeamEntity, { nullable: true, onDelete: 'SET NULL' })
  provisionalWinnerTeam?: TeamEntity | null;

  @ManyToOne(() => TeamEntity, { nullable: true, onDelete: 'SET NULL' })
  finalWinnerTeam?: TeamEntity | null;

  @Column({ default: false })
  forfeited!: boolean;

  @ManyToOne(() => TeamEntity, { nullable: true, onDelete: 'SET NULL' })
  forfeitedByTeam?: TeamEntity | null;

  @VersionColumn()
  version!: number;

  @Column({ type: 'int', nullable: true })
  reshuffleIndex?: number | null;

  @ManyToOne(() => TournamentEntity, (tournament: TournamentEntity) => tournament.matches, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  tournament!: TournamentEntity;

  @ManyToMany(() => TeamEntity, (team: TeamEntity) => team.matches)
  @JoinTable({
    name: 'match_participants',
    joinColumn: { name: 'match_id' },
    inverseJoinColumn: { name: 'team_id' },
  })
  participants!: TeamEntity[];

  @OneToMany(() => NotificationEntity, (notification: NotificationEntity) => notification.match)
  notifications!: NotificationEntity[];

  @OneToMany(() => MatchProofEntity, proof => proof.match)
  proofs!: MatchProofEntity[];

  @OneToMany(() => MatchDisputeEntity, dispute => dispute.match)
  disputes!: MatchDisputeEntity[];
}
