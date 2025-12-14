import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsEnum, IsNumber, IsObject, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';
import { PaymentRecordEntity } from '../../database/entities/payment-record.entity';

const DIRECTIONS: PaymentRecordEntity['direction'][] = ['credit', 'debit'];
const STATUSES: PaymentRecordEntity['status'][] = ['pending', 'success', 'failed', 'refunded'];

export class CreatePaymentRecordDto {
  @IsUUID()
  userId!: string;

  @IsEnum(DIRECTIONS)
  direction!: PaymentRecordEntity['direction'];

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsString()
  @Length(2, 80)
  gateway!: string;

  @IsString()
  @Length(2, 120)
  referenceId!: string;

  @IsOptional()
  @IsEnum(STATUSES)
  status?: PaymentRecordEntity['status'];

  @IsOptional()
  @IsUUID()
  tournamentId?: string;

  @IsOptional()
  @IsUUID()
  registrationId?: string;

  @IsOptional()
  @IsBoolean()
  escrowHold?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}

export class UpdatePaymentRecordDto {
  @IsOptional()
  @IsEnum(STATUSES)
  status?: PaymentRecordEntity['status'];

  @IsOptional()
  @IsBoolean()
  escrowHold?: boolean;
}

export class UpdatePaymentRecordStatusDto {
  @IsEnum(STATUSES)
  status!: PaymentRecordEntity['status'];

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  processedAt?: Date;
}

export class RecordLedgerDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsString()
  @Length(2, 80)
  gateway!: string;

  @IsString()
  @Length(2, 120)
  referenceId!: string;

  @IsOptional()
  @IsUUID()
  tournamentId?: string;

  @IsOptional()
  @IsUUID()
  registrationId?: string;

  @IsOptional()
  @IsBoolean()
  escrowHold?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
