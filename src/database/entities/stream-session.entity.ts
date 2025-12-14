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
import { TournamentEntity } from './tournament.entity';
import { MatchEntity } from './match.entity';
import { UserEntity } from './user.entity';

export enum StreamStatus {
  PENDING = 'pending',
  LIVE = 'live',
  ENDED = 'ended',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum StreamType {
  MATCH = 'match',
  TOURNAMENT = 'tournament',
  HIGHLIGHT = 'highlight',
}

export enum StreamQuality {
  AUTO = 'auto',
  LOW = '360p',
  MEDIUM = '720p',
  HIGH = '1080p',
  ULTRA = '4k',
}

@Entity('stream_sessions')
@Index(['tournamentId'])
@Index(['matchId'])
@Index(['streamerId'])
@Index(['status'])
@Index(['type'])
@Index(['startedAt'])
export class StreamSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  tournamentId!: string;

  @ManyToOne(() => TournamentEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tournamentId' })
  tournament?: TournamentEntity;

  @Column({ type: 'uuid', nullable: true })
  matchId!: string;

  @ManyToOne(() => MatchEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'matchId' })
  match?: MatchEntity;

  @Column({ type: 'uuid' })
  streamerId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'streamerId' })
  streamer!: UserEntity;

  @Column({
    type: 'enum',
    enum: StreamType,
    default: StreamType.MATCH,
  })
  type!: StreamType;

  @Column({
    type: 'enum',
    enum: StreamStatus,
    default: StreamStatus.PENDING,
  })
  status!: StreamStatus;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  thumbnailUrl?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  streamKey?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  rtmpUrl?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  hlsUrl?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  embedUrl?: string;

  @Column({
    type: 'enum',
    enum: StreamQuality,
    default: StreamQuality.AUTO,
  })
  quality!: StreamQuality;

  @Column({ type: 'int', nullable: true })
  viewerCount?: number;

  @Column({ type: 'int', default: 0 })
  maxViewers!: number;

  @Column({ type: 'jsonb', default: {} })
  metadata!: {
    platform: string;
    platformStreamId?: string;
    platformSettings?: Record<string, any>;
    recordingEnabled: boolean;
    autoHighlightEnabled: boolean;
    tags?: string[];
    language?: string;
  };

  @Column({ type: 'jsonb', default: {} })
  streamStats!: {
    duration?: number; // in seconds
    avgViewers?: number;
    peakViewers?: number;
    totalViews?: number;
    bandwidth?: number;
    droppedFrames?: number;
  };

  @Column({ type: 'jsonb', default: {} })
  recordingMetadata!: {
    enabled: boolean;
    startedAt?: Date;
    endedAt?: Date;
    duration?: number;
    fileSize?: number;
    format?: string;
    resolution?: string;
    fps?: number;
    bitrate?: number;
  };

  @Column({ type: 'jsonb', default: {} })
  highlightMarkers!: Array<{
    timestamp: number; // seconds from start
    type: 'kill' | 'death' | 'win' | 'clutch' | 'ace' | 'multikill' | 'custom';
    description: string;
    confidence?: number;
    metadata?: Record<string, any>;
  }>;

  @Column({ type: 'timestamptz', nullable: true })
  scheduledFor?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endedAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  archivedAt?: Date;

  @Column({ type: 'varchar', length: 50, default: 'global' })
  region!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
