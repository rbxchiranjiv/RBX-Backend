import { IsBoolean, IsOptional, IsUUID, IsObject } from 'class-validator';

export class CreateRegistrationDto {
  @IsUUID()
  tournamentId!: string;

  @IsUUID()
  teamId!: string;

  @IsOptional()
  @IsBoolean()
  invitedSlot?: boolean;

  @IsOptional()
  @IsUUID()
  paymentRecordId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}

export class UpdateRegistrationDto {
  @IsOptional()
  @IsBoolean()
  invitedSlot?: boolean;
}

export class CreateInvitedRegistrationDto {
  @IsUUID()
  tournamentId!: string;

  @IsUUID()
  teamId!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}

export class AssignRegistrationTeamDto {
  @IsUUID()
  teamId!: string;
}

export class MarkRegistrationPaidDto {
  @IsUUID()
  paymentRecordId!: string;
}
