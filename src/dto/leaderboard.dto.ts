import { IsEnum, IsOptional, IsString, IsNumber, IsInt, Min, Max, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { LeaderboardType, LeaderboardCategory } from '../database/entities/leaderboard-snapshot.entity';

export class GetLeaderboardDto {
  @IsEnum(LeaderboardType)
  type!: LeaderboardType;

  @IsEnum(LeaderboardCategory)
  category!: LeaderboardCategory;

  @IsOptional()
  @IsString()
  seasonId?: string;

  @IsOptional()
  @IsString()
  tournamentId?: string;

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
  @IsString()
  sortBy?: string = 'points';

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @IsObject()
  filters?: Record<string, any>;
}

export class RefreshLeaderboardDto {
  @IsEnum(LeaderboardType)
  type!: LeaderboardType;

  @IsEnum(LeaderboardCategory)
  category!: LeaderboardCategory;

  @IsOptional()
  @IsString()
  seasonId?: string;

  @IsOptional()
  @IsString()
  tournamentId?: string;

  @IsOptional()
  @IsString()
  region?: string;
}

export class GetStandingsDto {
  @IsString()
  tournamentId!: string;

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
}

export class GetSeasonStatsDto {
  @IsString()
  participantId!: string;

  @IsEnum(['team', 'player'])
  type!: 'team' | 'player';

  @IsOptional()
  @IsString()
  seasonId?: string;

  @IsOptional()
  @IsString()
  region?: string;
}

export class GetTopSeasonStatsDto {
  @IsOptional()
  @IsString()
  seasonId?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsEnum(['team', 'player'])
  category?: 'team' | 'player';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}

export class GetOrganizerStatsDto {
  @IsOptional()
  @IsString()
  seasonId?: string;

  @IsOptional()
  @IsString()
  region?: string;
}
