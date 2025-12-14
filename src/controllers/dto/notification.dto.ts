import { IsEnum, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { NotificationEntity } from '../../database/entities/notification.entity';

const CHANNELS: NotificationEntity['channel'][] = ['fcm', 'inApp', 'sms', 'email'];
const STATUSES: NotificationEntity['status'][] = ['queued', 'sent', 'delivered', 'failed', 'read'];

export class CreateNotificationDto {
  @IsUUID()
  userId!: string;

  @IsString()
  templateKey!: string;

  @IsEnum(CHANNELS)
  channel!: NotificationEntity['channel'];

  @IsObject()
  payload!: Record<string, unknown>;

  @IsOptional()
  @IsEnum(STATUSES)
  status?: NotificationEntity['status'];

  @IsOptional()
  @IsUUID()
  tournamentId?: string;

  @IsOptional()
  @IsUUID()
  matchId?: string;

  @IsOptional()
  @IsString()
  errorMessage?: string | null;
}

export class QueueNotificationDto {
  @IsUUID()
  userId!: string;

  @IsString()
  templateKey!: string;

  @IsEnum(CHANNELS)
  channel!: NotificationEntity['channel'];

  @IsObject()
  payload!: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  tournamentId?: string;

  @IsOptional()
  @IsUUID()
  matchId?: string;
}

export class UpdateNotificationDto {
  @IsOptional()
  @IsString()
  templateKey?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  errorMessage?: string | null;
}
