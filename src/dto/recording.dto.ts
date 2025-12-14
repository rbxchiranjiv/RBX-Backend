import { IsEnum, IsOptional, IsString, IsNumber, IsInt, IsBoolean, IsArray, IsObject, IsDateString, Min, Max, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { RecordingFormat, RecordingQuality, RecordingStatus } from '../database/entities/recording.entity';

export class CreateRecordingDto {
  @IsUUID()
  streamSessionId!: string;

  @IsOptional()
  @IsUUID()
  matchId?: string;

  @IsOptional()
  @IsUUID()
  tournamentId?: string;

  @IsUUID()
  recordedBy!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(RecordingFormat)
  format?: RecordingFormat;

  @IsOptional()
  @IsEnum(RecordingQuality)
  quality?: RecordingQuality;

  @IsOptional()
  @IsObject()
  metadata?: {
    platform?: string;
    platformRecordingId?: string;
    tags?: string[];
    language?: string;
    region?: string;
    autoRecorded?: boolean;
    backupEnabled?: boolean;
    priority?: number;
  };

  @IsOptional()
  @IsString()
  region?: string;
}

export class UpdateRecordingDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class RecordingQueryDto {
  @IsOptional()
  @IsUUID()
  streamSessionId?: string;

  @IsOptional()
  @IsUUID()
  matchId?: string;

  @IsOptional()
  @IsUUID()
  tournamentId?: string;

  @IsOptional()
  @IsUUID()
  recordedBy?: string;

  @IsOptional()
  @IsEnum(RecordingStatus)
  status?: RecordingStatus;

  @IsOptional()
  @IsEnum(RecordingFormat)
  format?: RecordingFormat;

  @IsOptional()
  @IsEnum(RecordingQuality)
  quality?: RecordingQuality;

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
  @IsEnum(['createdAt', 'startedAt', 'duration', 'views'])
  sortBy?: 'createdAt' | 'startedAt' | 'duration' | 'views' = 'createdAt';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class StartRecordingDto {
  @IsUUID()
  recordingId!: string;
}

export class StopRecordingDto {
  @IsUUID()
  recordingId!: string;
}

export class CompleteRecordingDto {
  @IsUUID()
  recordingId!: string;

  @IsString()
  videoUrl!: string;

  @IsString()
  downloadUrl!: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsOptional()
  @IsString()
  previewUrl?: string;

  @IsObject()
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
}

export class FailRecordingDto {
  @IsUUID()
  recordingId!: string;

  @IsString()
  errorMessage!: string;
}

export class AddClipMarkerDto {
  @IsUUID()
  recordingId!: string;

  @IsString()
  id!: string;

  @IsNumber()
  @Min(0)
  timestamp!: number;

  @IsEnum(['highlight', 'event', 'manual'])
  type!: 'highlight' | 'event' | 'manual';

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class RecordingStatsDto {
  @IsOptional()
  @IsUUID()
  recordedBy?: string;
}
