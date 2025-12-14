import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class SchedulePreviewDto {
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(600)
  matchSpacingMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  seed?: number;
}

export class ConfirmScheduleDto extends SchedulePreviewDto {}

export class ReshuffleScheduleDto extends SchedulePreviewDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
