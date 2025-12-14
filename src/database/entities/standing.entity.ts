import {
  Entity,
  Index,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TournamentEntity } from './tournament.entity';
import { TeamEntity } from './team.entity';
import { UserEntity } from './user.entity';

export enum StandingType {
  TOURNAMENT = 'tournament',
  SEASON = 'season',
  GLOBAL = 'global',
}

export enum StandingStatus {
  ACTIVE = 'active',
  FINAL = 'final',
  CALCULATING = 'calculating',
}

@Entity('standings')
@Index(['tournamentId', 'type', 'status'])
@Index(['teamId'])
@Index(['userId'])
@Index(['seasonId'])
@Index(['type', 'rank'])
export class StandingEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  tournamentId!: string;

  @ManyToOne(() => TournamentEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tournamentId' })
  tournament?: TournamentEntity;

  @Column({ type: 'uuid', nullable: true })
  teamId!: string;

  @ManyToOne(() => TeamEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teamId' })
  team?: TeamEntity;

  @Column({ type: 'uuid', nullable: true })
  userId!: string;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: UserEntity;

  @Column({ type: 'varchar', length: 50 })
  seasonId!: string;

  @Column({
    type: 'enum',
    enum: StandingType,
    default: StandingType.TOURNAMENT,
  })
  type!: StandingType;

  @Column({
    type: 'enum',
    enum: StandingStatus,
    default: StandingStatus.ACTIVE,
  })
  status!: StandingStatus;

  @Column({ type: 'int', default: 0 })
  rank!: number;

  @Column({ type: 'int', default: 0 })
  points!: number;

  @Column({ type: 'int', default: 0 })
  matchesPlayed!: number;

  @Column({ type: 'int', default: 0 })
  wins!: number;

  @Column({ type: 'int', default: 0 })
  losses!: number;

  @Column({ type: 'int', default: 0 })
  draws!: number;

  // BR-specific fields
  @Column({ type: 'int', default: 0 })
  kills!: number;

  @Column({ type: 'int', default: 0 })
  deaths!: number;

  @Column({ type: 'int', default: 0 })
  assists!: number;

  @Column({ type: 'int', default: 0 })
  survivalTime!: number; // in seconds

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  avgPlacement!: number;

  // CS-specific fields
  @Column({ type: 'int', default: 0 })
  roundsWon!: number;

  @Column({ type: 'int', default: 0 })
  roundsLost!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  kdratio!: number; // kill/death ratio

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  adr!: number; // average damage per round

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  hsPercentage!: number; // headshot percentage

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, any>;

  @Column({ type: 'varchar', length: 50, default: 'global' })
  region!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
