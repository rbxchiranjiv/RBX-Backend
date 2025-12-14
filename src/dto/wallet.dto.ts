import { IsString, IsEnum, IsNumber, IsOptional, IsUUID, Min, Max } from 'class-validator';
import { WalletCurrency } from '../database/entities/wallet.entity';
import { TransactionType, ReferenceType } from '../database/entities/wallet-transaction.entity';

export class CreateWalletDto {
  @IsEnum(WalletCurrency)
  @IsOptional()
  currency?: WalletCurrency = WalletCurrency.USD;
}

export class WalletTransactionDto {
  @IsEnum(TransactionType)
  type!: TransactionType;

  @IsNumber()
  @Min(0.01)
  @Max(999999.99)
  amount!: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsOptional()
  referenceId?: string;

  @IsEnum(ReferenceType)
  @IsOptional()
  referenceType?: ReferenceType;
}

export class WalletBalanceDto {
  balance!: number;
  availableBalance!: number;
  lockedBalance!: number;
}

export class WalletDto {
  id!: string;
  userId!: string;
  currency!: WalletCurrency;
  balance!: number;
  lockedBalance!: number;
  availableBalance!: number;
  status!: string;
  createdAt!: Date;
  updatedAt!: Date;
}

export class WalletTransactionResponseDto {
  id!: string;
  walletId!: string;
  type!: TransactionType;
  amount!: number;
  balanceBefore!: number;
  balanceAfter!: number;
  referenceId?: string;
  referenceType?: ReferenceType;
  description?: string;
  status!: string;
  createdAt!: Date;
  updatedAt!: Date;
}
