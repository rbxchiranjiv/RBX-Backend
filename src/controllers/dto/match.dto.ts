import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDate, IsEnum, IsNumber, IsObject, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { MatchEntity } from '../../database/entities/match.entity';

const MATCH_MODES: MatchEntity['mode'][] = ['BR', 'CS'];
const MATCH_STATUS: MatchEntity['status'][] = ['scheduled', 'ongoing', 'ended', 'cancelled'];

export class CreateMatchDto {
  @IsUUID()
  tournamentId!: string;

  @IsString()
  @Length(2, 40)
  code!: string;

  @IsEnum(MATCH_MODES)
  mode!: MatchEntity['mode'];

  @IsOptional()
  @IsEnum(MATCH_STATUS)
  status?: MatchEntity['status'];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  roundNumber?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  reshuffleCount?: number;

  @Type(() => Date)
  @IsDate()
  scheduledAt!: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startedAt?: Date | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endedAt?: Date | null;

  @IsOptional()
  @IsString()
  roomId?: string | null;

  @IsOptional()
  @IsString()
  roomPassword?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  participants?: string[];
}

export class ScheduleMatchDto {
  @IsString()
  @Length(2, 40)
  code!: string;

  @IsEnum(MATCH_MODES)
  mode!: MatchEntity['mode'];

  @Type(() => Date)
  @IsDate()
  scheduledAt!: Date;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  roundNumber?: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  participantTeamIds!: string[];
}

export class AssignParticipantsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  teamIds!: string[];
}

export class EndMatchDto {
  @IsOptional()
  @IsObject()
  resultMetadata?: Record<string, unknown>;
}

export class UpdateMatchDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  roundNumber?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  reshuffleCount?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  scheduledAt?: Date;

  @IsOptional()
  @IsString()
  roomId?: string | null;

  @IsOptional()
  @IsString()
  roomPassword?: string | null;
}
