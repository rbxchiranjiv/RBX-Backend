import { IsString, IsNumber, IsOptional, IsEnum, IsObject, IsBoolean, IsUUID } from 'class-validator';

export class WebhookEventDto {
  @IsString()
  gateway!: string;

  @IsString()
  eventId!: string;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;
}

export class InitiatePaymentDto {
  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  gateway?: string;

  @IsOptional()
  @IsBoolean()
  escrowHold?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreatePaymentDto {
  @IsNumber()
  amount!: number;

  @IsString()
  currency!: string;

  @IsString()
  gateway!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class EscrowBalanceDto {
  @IsNumber()
  amountCents!: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsUUID()
  relatedMatchId?: string;
}

export class PaymentRecordDto {
  @IsString()
  id!: string;

  @IsEnum(['credit', 'debit'])
  direction!: 'credit' | 'debit';

  @IsNumber()
  amount!: number;

  @IsString()
  currency!: string;

  @IsString()
  gateway!: string;

  @IsString()
  referenceId!: string;

  @IsEnum(['pending', 'success', 'failed', 'refunded'])
  status!: 'pending' | 'success' | 'failed' | 'refunded';

  @IsBoolean()
  escrowHold!: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class PaymentListDto {
  @IsOptional()
  @IsEnum(['pending', 'success', 'failed', 'refunded'])
  status?: 'pending' | 'success' | 'failed' | 'refunded';

  @IsOptional()
  @IsString()
  gateway?: string;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  limit?: number;
}
