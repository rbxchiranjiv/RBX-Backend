import {
  Entity,
  Index,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum WebhookType {
  STREAM_START = 'stream-start',
  STREAM_END = 'stream-end',
  STREAM_ERROR = 'stream-error',
  HIGHLIGHT_READY = 'highlight-ready',
  RECORDING_READY = 'recording-ready',
  UPLOAD_COMPLETED = 'upload-completed',
  UPLOAD_FAILED = 'upload-failed',
  VIEWER_COUNT_UPDATE = 'viewer-count-update',
  STREAM_STATUS_UPDATE = 'stream-status-update',
}

export enum WebhookStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

export enum WebhookProvider {
  TWITCH = 'twitch',
  YOUTUBE = 'youtube',
  FACEBOOK = 'facebook',
  RESTREAM = 'restream',
  CUSTOM = 'custom',
}

@Entity('stream_webhooks')
@Index(['streamSessionId'])
@Index(['type'])
@Index(['status'])
@Index(['provider'])
@Index(['createdAt'])
export class StreamWebhookEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  streamSessionId?: string;

  @Column({ type: 'uuid', nullable: true })
  recordingId?: string;

  @Column({ type: 'uuid', nullable: true })
  highlightId?: string;

  @Column({ type: 'uuid', nullable: true })
  uploadId?: string;

  @Column({
    type: 'enum',
    enum: WebhookType,
  })
  type!: WebhookType;

  @Column({
    type: 'enum',
    enum: WebhookStatus,
    default: WebhookStatus.PENDING,
  })
  status!: WebhookStatus;

  @Column({
    type: 'enum',
    enum: WebhookProvider,
  })
  provider!: WebhookProvider;

  @Column({ type: 'varchar', length: 255 })
  endpoint!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  event_id?: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, any>;

  @Column({ type: 'jsonb', default: {} })
  headers!: Record<string, string>;

  @Column({ type: 'text', nullable: true })
  signature?: string;

  @Column({ type: 'jsonb', default: {} })
  response!: {
    statusCode?: number;
    headers?: Record<string, string>;
    body?: string;
    duration?: number; // in milliseconds
  };

  @Column({ type: 'jsonb', default: {} })
  processingMetadata!: {
    attempts: number;
    maxAttempts: number;
    retryDelay: number; // in seconds
    lastAttemptAt?: Date;
    nextRetryAt?: Date;
    processingStartedAt?: Date;
    processingCompletedAt?: Date;
    processingDuration?: number;
  };

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'jsonb', default: {} })
  metadata!: {
    priority: number;
    timeout: number; // in seconds
    retryStrategy: 'linear' | 'exponential' | 'fixed';
    webhookSecret?: string;
    tags: string[];
  };

  @Column({ type: 'timestamptz', nullable: true })
  deliveredAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt?: Date;

  @Column({ type: 'varchar', length: 50, default: 'global' })
  region!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
