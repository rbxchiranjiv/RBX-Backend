import { ArrayMinSize, IsArray, IsBoolean, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateTeamDto {
  @IsString()
  @Length(2, 80)
  name!: string;

  @IsString()
  @Length(2, 16)
  slug!: string;

  @IsString()
  @Length(2, 40)
  region!: string;

  @IsUUID()
  ownerId!: string;

  @IsArray()
  @ArrayMinSize(4)
  @IsUUID(undefined, { each: true })
  memberIds!: string[];

  @IsOptional()
  @IsBoolean()
  verified?: boolean;
}

export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  @Length(2, 80)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(2, 16)
  slug?: string;

  @IsOptional()
  @IsString()
  @Length(2, 40)
  region?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsBoolean()
  verified?: boolean;
}

export class ModifyTeamMemberDto {
  @IsUUID()
  userId!: string;
}
