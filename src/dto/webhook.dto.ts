import { IsEnum, IsOptional, IsString, IsNumber, IsInt, IsBoolean, IsArray, IsObject, Min, Max, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { WebhookType, WebhookStatus, WebhookProvider } from '../database/entities/stream-webhook.entity';

export class CreateWebhookDto {
  @IsOptional()
  @IsUUID()
  streamSessionId?: string;

  @IsOptional()
  @IsUUID()
  recordingId?: string;

  @IsOptional()
  @IsUUID()
  highlightId?: string;

  @IsOptional()
  @IsUUID()
  uploadId?: string;

  @IsEnum(WebhookType)
  type!: WebhookType;

  @IsEnum(WebhookProvider)
  provider!: WebhookProvider;

  @IsString()
  endpoint!: string;

  @IsOptional()
  @IsString()
  event_id?: string;

  @IsObject()
  payload!: Record<string, any>;

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @IsOptional()
  @IsString()
  signature?: string;

  @IsOptional()
  @IsObject()
  metadata?: {
    priority?: number;
    timeout?: number;
    retryStrategy?: 'linear' | 'exponential' | 'fixed';
    webhookSecret?: string;
    tags?: string[];
  };

  @IsOptional()
  @IsString()
  region?: string;
}

export class WebhookQueryDto {
  @IsOptional()
  @IsUUID()
  streamSessionId?: string;

  @IsOptional()
  @IsUUID()
  recordingId?: string;

  @IsOptional()
  @IsUUID()
  highlightId?: string;

  @IsOptional()
  @IsUUID()
  uploadId?: string;

  @IsOptional()
  @IsEnum(WebhookType)
  type?: WebhookType;

  @IsOptional()
  @IsEnum(WebhookStatus)
  status?: WebhookStatus;

  @IsOptional()
  @IsEnum(WebhookProvider)
  provider?: WebhookProvider;

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
  @IsEnum(['createdAt', 'deliveredAt', 'attempts'])
  sortBy?: 'createdAt' | 'deliveredAt' | 'attempts' = 'createdAt';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class DeliverWebhookDto {
  @IsUUID()
  webhookId!: string;
}

export class RetryWebhookDto {
  @IsUUID()
  webhookId!: string;
}

export class FailWebhookDto {
  @IsUUID()
  webhookId!: string;

  @IsString()
  errorMessage!: string;
}

export class WebhookStatsDto {
  // No fields needed for stats query
}
