import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { WalletEntity, WalletStatus, WalletCurrency } from '../database/entities/wallet.entity';
import { WalletTransactionEntity, TransactionType, TransactionStatus, ReferenceType } from '../database/entities/wallet-transaction.entity';
import { UserEntity } from '../database/entities/user.entity';
import { PaymentRecordEntity, PaymentStatus } from '../database/entities/payment-record.entity';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(WalletEntity)
    private walletRepo: Repository<WalletEntity>,
    @InjectRepository(WalletTransactionEntity)
    private transactionRepo: Repository<WalletTransactionEntity>,
    @InjectRepository(PaymentRecordEntity)
    private paymentRepo: Repository<PaymentRecordEntity>,
    private dataSource: DataSource,
  ) {}

  async createWallet(userId: string, currency: WalletCurrency = WalletCurrency.USD): Promise<WalletEntity> {
    // Check if wallet already exists
    const existingWallet = await this.walletRepo.findOne({
      where: { userId, currency },
    });

    if (existingWallet) {
      return existingWallet;
    }

    const wallet = this.walletRepo.create({
      userId,
      currency,
      balance: 0,
      lockedBalance: 0,
      availableBalance: 0,
      status: WalletStatus.ACTIVE,
    });

    return await this.walletRepo.save(wallet);
  }

  async getWalletByUser(userId: string, currency?: WalletCurrency): Promise<WalletEntity[]> {
    const whereCondition: any = { userId };
    if (currency) {
      whereCondition.currency = currency;
    }

    return await this.walletRepo.find({
      where: whereCondition,
      relations: ['transactions'],
    });
  }

  async getWalletBalance(walletId: string): Promise<{ balance: number; availableBalance: number; lockedBalance: number }> {
    const wallet = await this.walletRepo.findOne({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return {
      balance: wallet.balance,
      availableBalance: wallet.availableBalance,
      lockedBalance: wallet.lockedBalance,
    };
  }

  async createTransaction(
    walletId: string,
    type: TransactionType,
    amount: number,
    description?: string,
    referenceId?: string,
    referenceType?: ReferenceType,
    metadata?: Record<string, any>,
  ): Promise<WalletTransactionEntity> {
    return await this.dataSource.transaction(async (manager) => {
      const wallet = await manager.findOne(WalletEntity, {
        where: { id: walletId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      if (wallet.status !== WalletStatus.ACTIVE) {
        throw new BadRequestException('Wallet is not active');
      }

      // Calculate balance changes
      let balanceChange = 0;
      let lockedBalanceChange = 0;

      switch (type) {
        case TransactionType.DEPOSIT:
        case TransactionType.TRANSFER_IN:
        case TransactionType.RELEASE:
          balanceChange = amount;
          break;
        case TransactionType.WITHDRAWAL:
        case TransactionType.TRANSFER_OUT:
        case TransactionType.HOLD:
          balanceChange = -amount;
          if (type === TransactionType.HOLD) {
            lockedBalanceChange = amount;
          }
          break;
        case TransactionType.FEE:
          balanceChange = -amount;
          break;
        case TransactionType.REFUND:
          balanceChange = amount;
          break;
        default:
          throw new BadRequestException('Invalid transaction type');
      }

      // Check sufficient funds for debit operations
      if (balanceChange < 0 && wallet.availableBalance + balanceChange < 0) {
        throw new BadRequestException('Insufficient funds');
      }

      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore + balanceChange;

      // Update wallet balance
      wallet.balance = balanceAfter;
      wallet.lockedBalance = wallet.lockedBalance + lockedBalanceChange;
      wallet.availableBalance = wallet.balance - wallet.lockedBalance;

      await manager.save(wallet);

      // Create transaction record
      const transaction = this.transactionRepo.create({
        walletId,
        type,
        amount,
        balanceBefore,
        balanceAfter,
        referenceId,
        referenceType,
        description,
        metadata,
        status: TransactionStatus.COMPLETED,
      });

      return await manager.save(transaction);
    });
  }

  async autoDepositFromPayment(paymentId: string): Promise<void> {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId, status: PaymentStatus.SUCCESS, autoWalletDeposit: true },
      relations: ['user'],
    });

    if (!payment || payment.walletTransactionId) {
      return; // Already processed or not eligible
    }

    // Get or create user wallet
    let wallet = await this.walletRepo.findOne({
      where: { userId: payment.user.id, currency: WalletCurrency.USD },
    });

    if (!wallet) {
      wallet = await this.createWallet(payment.user.id, WalletCurrency.USD);
    }

    // Create deposit transaction
    const transaction = await this.createTransaction(
      wallet.id,
      TransactionType.DEPOSIT,
      payment.amount,
      `Auto-deposit from payment ${payment.id}`,
      payment.id,
      ReferenceType.PAYMENT,
    );

    // Update payment record
    payment.walletId = wallet.id;
    payment.walletTransactionId = transaction.id;
    await this.paymentRepo.save(payment);
  }

  async getTransactionHistory(walletId: string, limit = 50, offset = 0): Promise<WalletTransactionEntity[]> {
    return await this.transactionRepo.find({
      where: { walletId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async holdFunds(walletId: string, amount: number, referenceId?: string, referenceType?: ReferenceType): Promise<WalletTransactionEntity> {
    return await this.createTransaction(
      walletId,
      TransactionType.HOLD,
      amount,
      'Funds held',
      referenceId,
      referenceType,
    );
  }

  async releaseFunds(walletId: string, amount: number, referenceId?: string, referenceType?: ReferenceType): Promise<WalletTransactionEntity> {
    return await this.createTransaction(
      walletId,
      TransactionType.RELEASE,
      amount,
      'Funds released',
      referenceId,
      referenceType,
    );
  }

  async createEscrowHold(walletId: string, amount: number, referenceId?: string, description?: string): Promise<WalletTransactionEntity> {
    return await this.holdFunds(walletId, amount, referenceId, ReferenceType.ESCROW_HOLD);
  }

  async releaseEscrowHold(holdId: string, amount?: number, description?: string): Promise<WalletTransactionEntity> {
    // Find the original hold transaction
    const holdTx = await this.transactionRepo.findOne({ where: { id: holdId } });
    if (!holdTx) {
      throw new NotFoundException('Escrow hold not found');
    }
    
    // Use the amount from hold if not specified
    const releaseAmount = amount || holdTx.amount;
    
    return await this.releaseFunds(
      holdTx.walletId,
      releaseAmount,
      holdId,
      ReferenceType.ESCROW_HOLD,
    );
  }
}
