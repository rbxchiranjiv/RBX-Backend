import { IsString, Length } from 'class-validator';

export class LoginDto {
  @IsString()
  @Length(6, 20)
  phoneNumber!: string;
}

export class RefreshDto {
  @IsString()
  @Length(20, 512)
  refreshToken!: string;
}

export class LogoutDto {
  @IsString()
  @Length(20, 512)
  refreshToken!: string;
}
