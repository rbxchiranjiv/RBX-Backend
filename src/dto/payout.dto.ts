import { IsString, IsNumber, IsOptional, IsEnum, IsObject, IsUUID, IsNotEmpty, IsBoolean } from 'class-validator';

export class CreatePayoutBatchDto {
  @IsUUID()
  @IsNotEmpty()
  organizerId!: string;

  @IsNumber()
  amountCents!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsObject()
  destinationInfo!: {
    accountIdentifier: string;
    gateway?: string;
  };
}

export class ProcessPayoutBatchDto {
  @IsOptional()
  @IsObject()
  options?: {
    dryRun?: boolean;
    force?: boolean;
  };
}

export class RetryPayoutBatchDto {
  @IsOptional()
  @IsObject()
  options?: {
    onlyFailed?: boolean;
    resetFailures?: boolean;
  };
}

export class UpdatePayoutTransactionDto {
  @IsOptional()
  @IsEnum(['pending', 'processing', 'sent', 'failed'])
  status?: 'pending' | 'processing' | 'sent' | 'failed';

  @IsOptional()
  @IsString()
  failureReason?: string;

  @IsOptional()
  @IsString()
  gatewayReference?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class PayoutBatchListDto {
  @IsOptional()
  @IsUUID()
  organizerId?: string;

  @IsOptional()
  @IsEnum(['pending', 'processing', 'sent', 'failed'])
  status?: 'pending' | 'processing' | 'sent' | 'failed';

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  limit?: number;
}

export class WebhookEventListDto {
  @IsOptional()
  @IsString()
  gateway?: string;

  @IsOptional()
  @IsBoolean()
  processed?: boolean;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  limit?: number;
}
