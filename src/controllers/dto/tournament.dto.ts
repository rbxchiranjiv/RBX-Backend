import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  IsDate,
} from 'class-validator';
import { TournamentEntity } from '../../database/entities/tournament.entity';

const TOURNAMENT_MODES: TournamentEntity['mode'][] = ['BR', 'CS'];

export class CreateTournamentDto {
  @IsString()
  @Length(3, 120)
  name!: string;

  @IsString()
  @Length(3, 80)
  slug!: string;

  @IsEnum(TOURNAMENT_MODES)
  mode!: TournamentEntity['mode'];

  @IsUUID()
  organizerId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  entryFee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  creationFee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  prizePool?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(2)
  @Max(1024)
  maxTeams?: number;

  @IsOptional()
  @IsBoolean()
  invitesEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isVersus?: boolean;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  registrationOpensAt?: Date | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  registrationClosesAt?: Date | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startsAt?: Date | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endsAt?: Date | null;
}

export class UpdateTournamentDto {
  @IsOptional()
  @IsString()
  @Length(3, 120)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(3, 80)
  slug?: string;

  @IsOptional()
  @IsEnum(TOURNAMENT_MODES)
  mode?: TournamentEntity['mode'];

  @IsOptional()
  @IsUUID()
  organizerId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  entryFee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  creationFee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  prizePool?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(2)
  @Max(1024)
  maxTeams?: number;

  @IsOptional()
  @IsBoolean()
  invitesEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isVersus?: boolean;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  registrationOpensAt?: Date | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  registrationClosesAt?: Date | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startsAt?: Date | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endsAt?: Date | null;
}

export class InviteTeamDto {
  @IsUUID()
  teamId!: string;
}
