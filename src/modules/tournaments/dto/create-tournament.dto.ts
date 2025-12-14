import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateTournamentDto {
  @IsString()
  name!: string;

  @IsIn(['BR', 'CS'])
  mode!: 'BR' | 'CS';

  @IsInt()
  @Min(0)
  entryFee!: number;

  @IsInt()
  @Min(2)
  @Max(1024)
  maxTeams!: number;

  @IsOptional()
  @IsString()
  description?: string;
}
