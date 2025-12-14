import { IsEnum, IsOptional, IsString, IsNumber, IsInt, IsBoolean, IsArray, IsObject, IsDateString, Min, Max, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { UploadType, UploadStatus, StorageProvider } from '../database/entities/cdn-upload.entity';

export class CreateUploadDto {
  @IsOptional()
  @IsUUID()
  recordingId?: string;

  @IsOptional()
  @IsUUID()
  highlightId?: string;

  @IsUUID()
  uploadedBy!: string;

  @IsEnum(UploadType)
  type!: UploadType;

  @IsEnum(StorageProvider)
  provider!: StorageProvider;

  @IsString()
  originalFileName!: string;

  @IsString()
  fileName!: string;

  @IsString()
  filePath!: string;

  @IsOptional()
  @IsString()
  bucket?: string;

  @IsOptional()
  @IsObject()
  fileMetadata?: {
    mimeType: string;
    size: number;
    checksum?: string;
    encoding?: string;
    lastModified?: string;
  };

  @IsOptional()
  @IsObject()
  storageMetadata?: {
    storageClass?: string;
    encryption?: string;
    backupEnabled?: boolean;
    retentionPeriod?: number;
    accessControl?: string;
  };

  @IsOptional()
  @IsObject()
  uploadMetadata?: {
    uploadId?: string;
    multipart?: boolean;
    partSize?: number;
    totalParts?: number;
  };

  @IsOptional()
  @IsObject()
  metadata?: {
    tags?: string[];
    language?: string;
    featured?: boolean;
    priority?: number;
    autoUploaded?: boolean;
    publicAccess?: boolean;
    allowedOrigins?: string[];
    maxDownloads?: number;
    downloadExpiry?: string;
  };

  @IsOptional()
  @IsString()
  region?: string;
}

export class UpdateUploadDto {
  @IsOptional()
  @IsEnum(UploadStatus)
  status?: UploadStatus;

  @IsOptional()
  @IsString()
  cdnUrl?: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsOptional()
  @IsString()
  previewUrl?: string;

  @IsOptional()
  @IsString()
  downloadUrl?: string;

  @IsOptional()
  @IsString()
  embedUrl?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class UploadQueryDto {
  @IsOptional()
  @IsUUID()
  recordingId?: string;

  @IsOptional()
  @IsUUID()
  highlightId?: string;

  @IsOptional()
  @IsUUID()
  uploadedBy?: string;

  @IsOptional()
  @IsEnum(UploadStatus)
  status?: UploadStatus;

  @IsOptional()
  @IsEnum(UploadType)
  type?: UploadType;

  @IsOptional()
  @IsEnum(StorageProvider)
  provider?: StorageProvider;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @IsEnum(['createdAt', 'size', 'downloads', 'views'])
  sortBy?: 'createdAt' | 'size' | 'downloads' | 'views' = 'createdAt';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class StartUploadDto {
  @IsUUID()
  uploadId!: string;
}

export class CompleteUploadDto {
  @IsUUID()
  uploadId!: string;

  @IsString()
  cdnUrl!: string;

  @IsOptional()
  @IsString()
  downloadUrl?: string;

  @IsOptional()
  @IsString()
  embedUrl?: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsOptional()
  @IsString()
  previewUrl?: string;
}

export class FinalizeUploadDto {
  @IsUUID()
  uploadId!: string;
}

export class FailUploadDto {
  @IsUUID()
  uploadId!: string;

  @IsString()
  errorMessage!: string;
}

export class GenerateSignedUrlDto {
  @IsUUID()
  uploadId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440) // 24 hours max
  expiryMinutes?: number = 60;
}

export class UpdateUploadAnalyticsDto {
  @IsUUID()
  uploadId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  downloads?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  views?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bandwidth?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  avgDownloadSpeed?: number;

  @IsOptional()
  @IsArray()
  popularRegions?: Array<{
    region: string;
    requests: number;
  }>;
}

export class UploadStatsDto {
  @IsOptional()
  @IsUUID()
  uploadedBy?: string;
}
