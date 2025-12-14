import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletService } from '../services/wallet.service';
import { WalletController } from '../controllers/wallet.controller';
import { WalletEntity } from '../database/entities/wallet.entity';
import { WalletTransactionEntity } from '../database/entities/wallet-transaction.entity';
import { PaymentRecordEntity } from '../database/entities/payment-record.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WalletEntity,
      WalletTransactionEntity,
      PaymentRecordEntity,
    ]),
  ],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
