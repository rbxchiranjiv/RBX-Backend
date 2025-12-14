import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class ScheduleMatchDto {
  @IsString()
  tournamentId!: string;

  @IsIn(['BR', 'CS'])
  mode!: 'BR' | 'CS';

  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsString()
  roomId?: string;
}
