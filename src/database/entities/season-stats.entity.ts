import {
  Entity,
  Index,
  Column,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { TeamEntity } from './team.entity';

@Entity('season_stats')
@Index(['seasonId', 'type'])
@Index(['teamId'])
@Index(['userId'])
@Index(['region'])
@Index(['seasonId', 'region', 'type'])
export class SeasonStatsEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  seasonId!: string;

  @Column({ type: 'uuid', nullable: true })
  teamId!: string;

  @ManyToOne(() => TeamEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teamId' })
  team!: TeamEntity | null;

  @Column({ type: 'uuid', nullable: true })
  userId!: string;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: UserEntity | null;

  @Column({ type: 'varchar', length: 20 })
  type!: 'team' | 'player';

  @Column({ type: 'varchar', length: 50, default: 'global' })
  region!: string;

  // Overall performance
  @Column({ type: 'int', default: 0 })
  tournamentsPlayed!: number;

  @Column({ type: 'int', default: 0 })
  tournamentsWon!: number;

  @Column({ type: 'int', default: 0 })
  totalPoints!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  avgPlacement!: number;

  @Column({ type: 'int', default: 0 })
  currentRank!: number;

  @Column({ type: 'int', default: 0 })
  peakRank!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  winRate!: number;

  // Match statistics
  @Column({ type: 'int', default: 0 })
  totalMatches!: number;

  @Column({ type: 'int', default: 0 })
  totalWins!: number;

  @Column({ type: 'int', default: 0 })
  totalLosses!: number;

  @Column({ type: 'int', default: 0 })
  totalDraws!: number;

  // BR-specific stats
  @Column({ type: 'int', default: 0 })
  totalKills!: number;

  @Column({ type: 'int', default: 0 })
  totalDeaths!: number;

  @Column({ type: 'int', default: 0 })
  totalAssists!: number;

  @Column({ type: 'int', default: 0 })
  totalSurvivalTime!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  avgKills!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  kdratio!: number;

  // CS-specific stats
  @Column({ type: 'int', default: 0 })
  totalRoundsWon!: number;

  @Column({ type: 'int', default: 0 })
  totalRoundsLost!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalADR!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  avgADR!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalHSPercentage!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  avgHSPercentage!: number;

  // Historical data
  @Column({ type: 'jsonb', default: {} })
  weeklyStats!: Record<string, {
    week: string;
    points: number;
    rank: number;
    tournaments: number;
    wins: number;
    losses: number;
  }>;

  @Column({ type: 'jsonb', default: {} })
  achievements!: {
    firstPlace: number;
    top3: number;
    top5: number;
    top10: number;
    perfectGames: number;
    longestWinStreak: number;
    currentWinStreak: number;
    firstTournament: boolean;
    tenTournaments: boolean;
    hundredTournaments: boolean;
  };

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
