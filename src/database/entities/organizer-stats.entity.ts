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

@Entity('organizer_stats')
@Index(['organizerId'])
@Index(['seasonId'])
@Index(['region'])
@Index(['seasonId', 'region'])
export class OrganizerStatsEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizerId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizerId' })
  organizer!: UserEntity;

  @Column({ type: 'varchar', length: 50 })
  seasonId!: string;

  @Column({ type: 'varchar', length: 50, default: 'global' })
  region!: string;

  // Tournament organization stats
  @Column({ type: 'int', default: 0 })
  tournamentsOrganized!: number;

  @Column({ type: 'int', default: 0 })
  tournamentsCompleted!: number;

  @Column({ type: 'int', default: 0 })
  tournamentsCancelled!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalPrizePool!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalRevenue!: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalFeesCollected!: number;

  // Participation metrics
  @Column({ type: 'int', default: 0 })
  totalParticipants!: number;

  @Column({ type: 'int', default: 0 })
  uniqueParticipants!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  avgParticipantsPerTournament!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  participantRetentionRate!: number;

  // Quality metrics
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  avgTournamentRating!: number;

  @Column({ type: 'int', default: 0 })
  totalRatings!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  disputeRate!: number;

  @Column({ type: 'int', default: 0 })
  totalDisputes!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  disputeResolutionRate!: number;

  // Mode-specific stats
  @Column({ type: 'jsonb', default: {} })
  modeStats!: {
    BR: {
      tournaments: number;
      participants: number;
      avgDuration: number;
      avgRating: number;
    };
    CS: {
      tournaments: number;
      participants: number;
      avgDuration: number;
      avgRating: number;
    };
  };

  // Performance metrics
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  organizerScore!: number; // Overall performance score

  @Column({ type: 'int', default: 0 })
  organizerRank!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  organizerScoreChange!: number; // Change from previous period

  @Column({ type: 'jsonb', default: {} })
  achievements!: {
    firstTournament: boolean;
    tenTournaments: boolean;
    hundredTournaments: boolean;
    thousandParticipants: boolean;
    perfectRating: boolean;
    topOrganizer: boolean;
  };

  @Column({ type: 'jsonb', default: {} })
  monthlyStats!: Record<string, {
    tournaments: number;
    participants: number;
    revenue: number;
    rating: number;
  }>;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
