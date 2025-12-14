import { IsBoolean, IsString } from 'class-validator';

export class UpdateFeatureFlagDto {
  @IsString()
  flagKey!: string;

  @IsBoolean()
  enabled!: boolean;
}
