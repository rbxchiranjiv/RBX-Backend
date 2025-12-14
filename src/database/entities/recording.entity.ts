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
import { StreamSessionEntity } from './stream-session.entity';
import { MatchEntity } from './match.entity';
import { UserEntity } from './user.entity';
import { TournamentEntity } from './tournament.entity';

export enum RecordingStatus {
  INITIALIZING = 'initializing',
  RECORDING = 'recording',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  ARCHIVED = 'archived',
}

export enum RecordingFormat {
  MP4 = 'mp4',
  MKV = 'mkv',
  WEBM = 'webm',
  AVI = 'avi',
  MOV = 'mov',
}

export enum RecordingQuality {
  LOW = '360p',
  MEDIUM = '720p',
  HIGH = '1080p',
  ULTRA = '4k',
  ORIGINAL = 'original',
}

@Entity('recordings')
@Index(['streamSessionId'])
@Index(['matchId'])
@Index(['tournamentId'])
@Index(['recordedBy'])
@Index(['status'])
@Index(['format'])
@Index(['startedAt'])
export class RecordingEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  streamSessionId!: string;

  @ManyToOne(() => StreamSessionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'streamSessionId' })
  streamSession!: StreamSessionEntity;

  @Column({ type: 'uuid', nullable: true })
  matchId!: string;

  @ManyToOne(() => MatchEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'matchId' })
  match?: MatchEntity;

  @Column({ type: 'uuid', nullable: true })
  tournamentId!: string;

  @ManyToOne(() => TournamentEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tournamentId' })
  tournament?: TournamentEntity;

  @Column({ type: 'uuid' })
  recordedBy!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recordedBy' })
  recorder!: UserEntity;

  @Column({
    type: 'enum',
    enum: RecordingStatus,
    default: RecordingStatus.INITIALIZING,
  })
  status!: RecordingStatus;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: RecordingFormat,
    default: RecordingFormat.MP4,
  })
  format!: RecordingFormat;

  @Column({
    type: 'enum',
    enum: RecordingQuality,
    default: RecordingQuality.HIGH,
  })
  quality!: RecordingQuality;

  @Column({ type: 'varchar', length: 255, nullable: true })
  videoUrl?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  downloadUrl?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  thumbnailUrl?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  previewUrl?: string;

  @Column({ type: 'jsonb', default: {} })
  videoMetadata!: {
    resolution: string;
    fps: number;
    bitrate: number;
    codec: string;
    aspectRatio: string;
    fileSize: number;
    duration: number;
    audioCodec?: string;
    audioBitrate?: number;
  };

  @Column({ type: 'jsonb', default: {} })
  recordingMetadata!: {
    startedAt?: Date;
    endedAt?: Date;
    duration?: number; // in seconds
    fileSize?: number; // in bytes
    segments: number;
    droppedFrames: number;
    avgBitrate: number;
    maxBitrate: number;
    audioEnabled: boolean;
    videoEnabled: boolean;
  };

  @Column({ type: 'jsonb', default: {} })
  processingMetadata!: {
    processingStartedAt?: Date;
    processingCompletedAt?: Date;
    processingDuration?: number;
    processingSteps: Array<{
      step: string;
      startedAt: Date;
      completedAt?: Date;
      status: 'pending' | 'processing' | 'completed' | 'failed';
      error?: string;
    }>;
    retryCount: number;
    lastRetryAt?: Date;
  };

  @Column({ type: 'jsonb', default: [] })
  clipMarkers!: Array<{
    id: string;
    timestamp: number; // seconds from start
    type: 'highlight' | 'event' | 'manual';
    title: string;
    description?: string;
    confidence?: number;
    metadata?: Record<string, any>;
  }>;

  @Column({ type: 'jsonb', default: {} })
  storageMetadata!: {
    provider: string;
    bucket?: string;
    path?: string;
    cdnUrl?: string;
    signedUrl?: string;
    signedUrlExpiry?: Date;
    uploadId?: string;
    multipart?: boolean;
    parts?: Array<{
      partNumber: number;
      etag: string;
      size: number;
    }>;
  };

  @Column({ type: 'jsonb', default: {} })
  analytics!: {
    views: number;
    downloads: number;
    bandwidth: number; // total bandwidth used
    avgWatchTime: number; // in seconds
    completionRate: number; // percentage
    popularSegments: Array<{
      startTime: number;
      endTime: number;
      views: number;
    }>;
  };

  @Column({ type: 'jsonb', default: {} })
  metadata!: {
    platform: string;
    platformRecordingId?: string;
    tags: string[];
    language?: string;
    region?: string;
    autoRecorded: boolean;
    backupEnabled: boolean;
    priority: number;
  };

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'int', default: 0 })
  retryCount!: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastRetryAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endedAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  archivedAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt?: Date;

  @Column({ type: 'varchar', length: 50, default: 'global' })
  region!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
