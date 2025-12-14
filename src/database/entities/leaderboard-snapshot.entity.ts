import {
  Entity,
  Index,
  Column,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';
import { TournamentEntity } from './tournament.entity';

export enum LeaderboardType {
  TOURNAMENT = 'tournament',
  SEASON = 'season',
  GLOBAL = 'global',
}

export enum LeaderboardCategory {
  TEAMS = 'teams',
  PLAYERS = 'players',
  ORGANIZERS = 'organizers',
}

@Entity('leaderboard_snapshots')
@Index(['type', 'category', 'seasonId', 'region'])
@Index(['tournamentId'])
@Index(['seasonId'])
@Index(['createdAt'])
export class LeaderboardSnapshotEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  tournamentId!: string;

  @ManyToOne(() => TournamentEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tournamentId' })
  tournament?: TournamentEntity;

  @Column({ type: 'varchar', length: 50 })
  seasonId!: string;

  @Column({
    type: 'enum',
    enum: LeaderboardType,
  })
  type!: LeaderboardType;

  @Column({
    type: 'enum',
    enum: LeaderboardCategory,
  })
  category!: LeaderboardCategory;

  @Column({ type: 'varchar', length: 50, default: 'global' })
  region!: string;

  @Column({ type: 'jsonb' })
  data!: {
    entries: Array<{
      id: string;
      name: string;
      rank: number;
      points: number;
      stats: Record<string, any>;
      change?: number; // rank change from previous snapshot
    }>;
    totalEntries: number;
    lastUpdated: string;
  };

  @Column({ type: 'varchar', length: 100 })
  snapshotKey!: string; // Used for cache invalidation

  @Column({ type: 'int', default: 100 })
  maxEntries!: number; // Maximum entries in this snapshot

  @Column({ type: 'jsonb', default: {} })
  filters!: Record<string, any>; // Applied filters for this snapshot

  @Column({ type: 'varchar', length: 50, default: 'points' })
  sortBy!: string; // Primary sorting field

  @Column({ type: 'varchar', length: 10, default: 'desc' })
  sortOrder!: 'asc' | 'desc';

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
