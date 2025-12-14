import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { UserEntity, UserRole } from '../../database/entities/user.entity';

const USER_ROLES: UserRole[] = [UserRole.PLAYER, UserRole.ORGANIZER, UserRole.ADMIN];

export class CreateUserDto {
  @IsString()
  @Length(2, 80)
  displayName!: string;

  @IsString()
  @Length(6, 20)
  phoneNumber!: string;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsEnum(USER_ROLES)
  role?: UserEntity['role'];

  @IsOptional()
  @IsString()
  @Length(2, 8)
  countryCode?: string | null;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  deviceId?: string | null;

  @IsOptional()
  @IsBoolean()
  kycVerified?: boolean;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(2, 80)
  displayName?: string;

  @IsOptional()
  @IsString()
  @Length(6, 20)
  phoneNumber?: string;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsEnum(USER_ROLES)
  role?: UserEntity['role'];

  @IsOptional()
  @IsString()
  @Length(2, 8)
  countryCode?: string | null;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  deviceId?: string | null;

  @IsOptional()
  @IsBoolean()
  kycVerified?: boolean;
}
