import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class StartMatchDto {
  @IsOptional()
  @IsString()
  @Length(2, 40)
  roomId?: string;

  @IsOptional()
  @IsString()
  @Length(2, 40)
  roomPassword?: string;
}

export class EndMatchDto {
  @IsObject()
  resultPayload!: Record<string, unknown>;

  @IsUUID()
  winnerTeamId!: string;

  @IsOptional()
  @IsString()
  proofUrl?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class ForfeitMatchDto {
  @IsUUID()
  forfeitingTeamId!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class FinalizeMatchDto {
  @IsOptional()
  @IsUUID()
  winnerTeamId?: string;

  @IsOptional()
  @IsObject()
  adminDecision?: Record<string, unknown>;
}

export class RevertMatchDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RecordProofDto {
  @IsString()
  @Length(5, 2048)
  proofUrl!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  teamId?: string;
}

export class CreateMatchDisputeDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsOptional()
  @IsObject()
  evidence?: Record<string, unknown>;
}

export class ResolveMatchDisputeDto {
  @IsEnum(['upheld', 'rejected', 'rerun'] as const)
  decision!: 'upheld' | 'rejected' | 'rerun';

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
