import { IsEnum, IsOptional, IsString, IsNumber, IsInt, IsBoolean, IsArray, IsObject, IsDateString, Min, Max, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { StreamType, StreamStatus, StreamQuality } from '../database/entities/stream-session.entity';

export class CreateStreamSessionDto {
  @IsOptional()
  @IsUUID()
  tournamentId?: string;

  @IsOptional()
  @IsUUID()
  matchId?: string;

  @IsUUID()
  streamerId!: string;

  @IsEnum(StreamType)
  type!: StreamType;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(StreamQuality)
  quality?: StreamQuality;

  @IsOptional()
  @IsDateString()
  scheduledFor?: string;

  @IsOptional()
  @IsObject()
  metadata?: {
    platform?: string;
    platformStreamId?: string;
    platformSettings?: Record<string, any>;
    recordingEnabled?: boolean;
    autoHighlightEnabled?: boolean;
    tags?: string[];
    language?: string;
  };

  @IsOptional()
  @IsString()
  region?: string;
}

export class UpdateStreamSessionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(StreamQuality)
  quality?: StreamQuality;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsDateString()
  scheduledFor?: string;
}

export class StreamSessionQueryDto {
  @IsOptional()
  @IsUUID()
  tournamentId?: string;

  @IsOptional()
  @IsUUID()
  matchId?: string;

  @IsOptional()
  @IsUUID()
  streamerId?: string;

  @IsOptional()
  @IsEnum(StreamType)
  type?: StreamType;

  @IsOptional()
  @IsEnum(StreamStatus)
  status?: StreamStatus;

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
  @IsEnum(['createdAt', 'startedAt', 'viewerCount', 'maxViewers'])
  sortBy?: 'createdAt' | 'startedAt' | 'viewerCount' | 'maxViewers' = 'createdAt';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class StartStreamDto {
  @IsUUID()
  streamSessionId!: string;
}

export class EndStreamDto {
  @IsUUID()
  streamSessionId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateViewerCountDto {
  @IsUUID()
  streamSessionId!: string;

  @IsNumber()
  @Min(0)
  viewerCount!: number;
}

export class AddHighlightMarkerDto {
  @IsUUID()
  streamSessionId!: string;

  @IsNumber()
  @Min(0)
  timestamp!: number;

  @IsString()
  type!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class StreamStatsDto {
  @IsUUID()
  streamerId!: string;
}
