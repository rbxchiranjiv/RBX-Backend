import { EntityManager, Repository } from 'typeorm';
import type { GlobalConfig } from 'types/globalConfig';
import { 
  PayoutBatchEntity, 
  PayoutTransactionEntity, 
  EscrowAccountEntity, 
  LedgerEntryEntity,
  UserEntity 
} from '../database/entities';
import { NotFoundError, ValidationError } from './errors';
import { NotificationService } from './notification.service';

// Forward declaration to avoid circular dependency
interface PaymentGatewayService {
  createPayout(gateway: string, transaction: PayoutTransactionEntity): Promise<{
    success: boolean;
    reference?: string;
    error?: string;
  }>;
}

export interface SchedulePayoutInput {
  organizerId: string;
  amountCents: number;
  currency: string;
  destinationInfo: {
    accountIdentifier: string;
    gateway?: string;
  };
}

export interface ProcessPayoutResult {
  batchId: string;
  successCount: number;
  failureCount: number;
  errors: Array<{ transactionId: string; error: string }>;
}

export class PayoutService {
  constructor(
    private readonly payoutBatchRepo: Repository<PayoutBatchEntity>,
    private readonly payoutTransactionRepo: Repository<PayoutTransactionEntity>,
    private readonly escrowRepo: Repository<EscrowAccountEntity>,
    private readonly ledgerRepo: Repository<LedgerEntryEntity>,
    private readonly paymentGatewayService: PaymentGatewayService,
    private readonly notificationService: NotificationService,
    private readonly config: GlobalConfig,
  ) {}

  async schedulePayout(input: SchedulePayoutInput, createdBy: string): Promise<PayoutBatchEntity> {
    // Validate minimum payout amount
    if (input.amountCents < this.config.payments.payoutMinAmountCents) {
      throw new ValidationError(`Minimum payout amount is ${this.config.payments.payoutMinAmountCents} cents`);
    }

    // Find organizer's escrow account
    const escrow = await this.escrowRepo.findOne({
      where: { ownerUserId: input.organizerId },
    });

    if (!escrow) {
      throw new NotFoundError('EscrowAccount', `for organizer ${input.organizerId}`);
    }

    // Check available balance
    const availableBalance = escrow.balanceCents - escrow.lockedCents;
    if (availableBalance < input.amountCents) {
      throw new ValidationError('Insufficient available balance for payout');
    }

    return this.payoutBatchRepo.manager.transaction(async manager => {
      const batchRepo = manager.getRepository(PayoutBatchEntity);
      const transactionRepo = manager.getRepository(PayoutTransactionEntity);
      const escrowRepo = manager.getRepository(EscrowAccountEntity);

      // Create payout batch
      const batch = batchRepo.create({
        status: 'pending',
        totalAmountCents: input.amountCents,
        currency: input.currency,
        createdByUser: createdBy,
        metadata: {
          organizerId: input.organizerId,
          destinationInfo: input.destinationInfo,
        },
      });

      const savedBatch = await batchRepo.save(batch);

      // Create payout transaction
      const transaction = transactionRepo.create({
        batchId: savedBatch.id,
        toAccountIdentifier: input.destinationInfo.accountIdentifier,
        amountCents: input.amountCents,
        currency: input.currency,
        status: 'pending',
        metadata: {
          organizerId: input.organizerId,
          gateway: input.destinationInfo.gateway || this.config.payments.payoutGateway,
        },
      });

      await transactionRepo.save(transaction);

      return savedBatch;
    });
  }

  async processPayoutBatch(batchId: string): Promise<ProcessPayoutResult> {
    const batch = await this.payoutBatchRepo.findOne({
      where: { id: batchId },
      relations: ['transactions'],
    });

    if (!batch) {
      throw new NotFoundError('PayoutBatch', batchId);
    }

    if (batch.status !== 'pending') {
      throw new ValidationError('Batch can only be processed when status is pending');
    }

    // Update batch status to processing
    batch.status = 'processing';
    await this.payoutBatchRepo.save(batch);

    const result: ProcessPayoutResult = {
      batchId,
      successCount: 0,
      failureCount: 0,
      errors: [],
    };

    const organizerId = batch.metadata?.organizerId as string;

    for (const transaction of batch.transactions) {
      try {
        await this.processSingleTransaction(transaction, organizerId);
        result.successCount++;
      } catch (error) {
        result.failureCount++;
        result.errors.push({
          transactionId: transaction.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        // Update transaction status to failed
        transaction.status = 'failed';
        transaction.failureReason = error instanceof Error ? error.message : 'Unknown error';
        await this.payoutTransactionRepo.save(transaction);
      }
    }

    // Update batch status based on results
    if (result.failureCount === 0) {
      batch.status = 'sent';
    } else if (result.successCount === 0) {
      batch.status = 'failed';
    } else {
      batch.status = 'sent'; // Partial success
    }

    await this.payoutBatchRepo.save(batch);

    // Send notification to organizer
    await this.notificationService.queue(
      organizerId,
      'payoutProcessed',
      'inApp',
      {
        batchId: batch.id,
        amountCents: batch.totalAmountCents,
        currency: batch.currency,
        successCount: result.successCount,
        failureCount: result.failureCount,
      },
      {
        tournamentId: undefined, // Payout notifications don't have tournament context
      }
    );

    return result;
  }

  private async processSingleTransaction(
    transaction: PayoutTransactionEntity,
    organizerId: string
  ): Promise<void> {
    // Update transaction status to processing
    transaction.status = 'processing';
    await this.payoutTransactionRepo.save(transaction);

    // Call payment gateway
    const gateway = transaction.metadata?.gateway as string || this.config.payments.payoutGateway;
    const gatewayResult = await this.paymentGatewayService.createPayout(gateway, transaction);

    if (!gatewayResult.success) {
      throw new Error(gatewayResult.error || 'Gateway processing failed');
    }

    // Update transaction with gateway reference
    transaction.status = 'sent';
    transaction.gatewayReference = gatewayResult.reference;
    await this.payoutTransactionRepo.save(transaction);

    // Create ledger entries in a transaction
    await this.payoutTransactionRepo.manager.transaction(async manager => {
      const escrowRepo = manager.getRepository(EscrowAccountEntity);
      const ledgerRepo = manager.getRepository(LedgerEntryEntity);

      const escrow = await escrowRepo.findOne({
        where: { ownerUserId: organizerId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!escrow) {
        throw new NotFoundError('EscrowAccount', `for organizer ${organizerId}`);
      }

      // Debit from escrow
      escrow.balanceCents -= transaction.amountCents;
      await escrowRepo.save(escrow);

      // Create payout ledger entry
      const payoutLedger = ledgerRepo.create({
        escrowAccountId: escrow.id,
        kind: 'payout',
        amountCents: transaction.amountCents,
        currency: transaction.currency,
        metadata: {
          batchId: transaction.batchId,
          transactionId: transaction.id,
          gatewayReference: gatewayResult.reference,
        },
      });

      await ledgerRepo.save(payoutLedger);

      // Create platform fee ledger entry
      const platformFeeCents = Math.floor(
        (transaction.amountCents * this.config.payments.platformFeePercent) / 100
      );

      if (platformFeeCents > 0) {
        const feeLedger = ledgerRepo.create({
          escrowAccountId: escrow.id,
          kind: 'fee',
          amountCents: platformFeeCents,
          currency: transaction.currency,
          metadata: {
            type: 'platform_fee',
            batchId: transaction.batchId,
            transactionId: transaction.id,
            feePercent: this.config.payments.platformFeePercent,
          },
        });

        await ledgerRepo.save(feeLedger);
      }
    });
  }

  async retryFailedTransactions(batchId: string): Promise<ProcessPayoutResult> {
    const batch = await this.payoutBatchRepo.findOne({
      where: { id: batchId },
      relations: ['transactions'],
    });

    if (!batch) {
      throw new NotFoundError('PayoutBatch', batchId);
    }

    // Filter only failed transactions
    const failedTransactions = batch.transactions.filter(t => t.status === 'failed');
    
    if (failedTransactions.length === 0) {
      throw new ValidationError('No failed transactions to retry');
    }

    // Reset failed transactions to pending
    for (const transaction of failedTransactions) {
      transaction.status = 'pending';
      transaction.failureReason = null;
      transaction.gatewayReference = null;
    }

    await this.payoutTransactionRepo.save(failedTransactions);

    // Reset batch status and reprocess
    batch.status = 'pending';
    await this.payoutBatchRepo.save(batch);

    return this.processPayoutBatch(batchId);
  }

  async getBatch(batchId: string): Promise<PayoutBatchEntity | null> {
    return this.payoutBatchRepo.findOne({
      where: { id: batchId },
      relations: ['transactions', 'user'],
    });
  }

  async listBatches(organizerId?: string, status?: PayoutBatchEntity['status']): Promise<PayoutBatchEntity[]> {
    const where: any = {};
    if (organizerId) {
      where.metadata = { organizerId };
    }
    if (status) {
      where.status = status;
    }

    return this.payoutBatchRepo.find({
      where,
      relations: ['transactions', 'user'],
      order: { createdAt: 'DESC' },
    });
  }
}
