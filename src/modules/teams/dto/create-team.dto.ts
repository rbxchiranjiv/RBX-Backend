import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString } from 'class-validator';

export class CreateTeamDto {
  @IsString()
  name!: string;

  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(6)
  members!: string[];

  @IsOptional()
  @IsString()
  gameHandle?: string;
}
