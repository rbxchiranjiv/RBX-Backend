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
import { RecordingEntity } from './recording.entity';
import { HighlightEntity } from './highlight.entity';

export enum UploadStatus {
  PENDING = 'pending',
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

export enum UploadType {
  RECORDING = 'recording',
  HIGHLIGHT = 'highlight',
  THUMBNAIL = 'thumbnail',
  AVATAR = 'avatar',
  BANNER = 'banner',
  DOCUMENT = 'document',
}

export enum StorageProvider {
  AWS_S3 = 'aws_s3',
  GOOGLE_CLOUD = 'google_cloud',
  AZURE_BLOB = 'azure_blob',
  CLOUDFLARE_R2 = 'cloudflare_r2',
  DIGITALOCEAN = 'digitalocean',
  CUSTOM = 'custom',
}

@Entity('cdn_uploads')
@Index(['uploadedBy'])
@Index(['status'])
@Index(['type'])
@Index(['provider'])
@Index(['recordingId'])
@Index(['highlightId'])
@Index(['createdAt'])
export class CdnUploadEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  recordingId!: string;

  @ManyToOne(() => RecordingEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recordingId' })
  recording?: RecordingEntity;

  @Column({ type: 'uuid', nullable: true })
  highlightId!: string;

  @ManyToOne(() => HighlightEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'highlightId' })
  highlight?: HighlightEntity;

  @Column({ type: 'uuid' })
  uploadedBy!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'uploadedBy' })
  uploader!: UserEntity;

  @Column({
    type: 'enum',
    enum: UploadStatus,
    default: UploadStatus.PENDING,
  })
  status!: UploadStatus;

  @Column({
    type: 'enum',
    enum: UploadType,
  })
  type!: UploadType;

  @Column({
    type: 'enum',
    enum: StorageProvider,
    default: StorageProvider.AWS_S3,
  })
  provider!: StorageProvider;

  @Column({ type: 'varchar', length: 255 })
  originalFileName!: string;

  @Column({ type: 'varchar', length: 255 })
  fileName!: string;

  @Column({ type: 'varchar', length: 500 })
  filePath!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  bucket?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  cdnUrl?: string;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  signedUrl?: string;

  @Column({ type: 'timestamptz', nullable: true })
  signedUrlExpiry?: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  thumbnailUrl?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  previewUrl?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  downloadUrl?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  embedUrl?: string;

  @Column({ type: 'jsonb', default: {} })
  fileMetadata!: {
    mimeType: string;
    size: number; // in bytes
    checksum?: string;
    encoding?: string;
    lastModified?: Date;
  };

  @Column({ type: 'jsonb', default: {} })
  uploadMetadata!: {
    uploadId?: string;
    multipart?: boolean;
    partSize?: number;
    totalParts?: number;
    completedParts: Array<{
      partNumber: number;
      etag: string;
      size: number;
    }>;
    uploadStartedAt?: Date;
    uploadCompletedAt?: Date;
    uploadDuration?: number;
    avgUploadSpeed?: number; // in bytes per second
    retryCount: number;
    lastRetryAt?: Date;
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
    transcodingEnabled: boolean;
    outputFormats?: string[];
    thumbnailGenerated: boolean;
    previewGenerated: boolean;
  };

  @Column({ type: 'jsonb', default: {} })
  storageMetadata!: {
    provider: string;
    bucket: string;
    storageClass?: string;
    encryption?: string;
    backupEnabled: boolean;
    retentionPeriod?: number; // in days
    accessControl?: string;
  };

  @Column({ type: 'jsonb', default: {} })
  analytics!: {
    downloads: number;
    views: number;
    bandwidth: number; // total bandwidth used
    avgDownloadSpeed: number;
    popularRegions: Array<{
      region: string;
      requests: number;
    }>;
  };

  @Column({ type: 'jsonb', default: {} })
  metadata!: {
    tags: string[];
    language?: string;
    featured: boolean;
    priority: number;
    autoUploaded: boolean;
    publicAccess: boolean;
    allowedOrigins?: string[];
    maxDownloads?: number;
    downloadExpiry?: Date;
  };

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'int', default: 0 })
  retryCount!: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastRetryAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  archivedAt?: Date;

  @Column({ type: 'varchar', length: 50, default: 'global' })
  region!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
