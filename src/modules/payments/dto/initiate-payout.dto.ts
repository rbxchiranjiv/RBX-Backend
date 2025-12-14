import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class InitiatePayoutDto {
  @IsString()
  teamId!: string;

  @IsNumber()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
