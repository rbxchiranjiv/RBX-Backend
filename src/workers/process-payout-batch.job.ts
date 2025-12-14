import { Repository } from 'typeorm';
import { 
  PayoutBatchEntity, 
  PayoutTransactionEntity,
  LedgerEntryEntity,
  EscrowAccountEntity 
} from '../database/entities';
import { PayoutService } from '../services/payout.service';
import { PaymentGatewayService } from '../services/payment-gateway.service';
import { NotificationService } from '../services/notification.service';
import type { GlobalConfig } from 'types/globalConfig';

export interface ProcessPayoutBatchJobInput {
  batchId: string;
  initiatedBy?: string;
  retryFailed?: boolean;
}

export interface ProcessPayoutBatchJobResult {
  success: boolean;
  batchId: string;
  processedCount: number;
  successCount: number;
  failureCount: number;
  errors: Array<{
    transactionId: string;
    error: string;
  }>;
  totalAmountCents: number;
  gatewayFeesCents: number;
  netPayoutCents: number;
}

export class ProcessPayoutBatchJob {
  constructor(
    private readonly payoutBatchRepo: Repository<PayoutBatchEntity>,
    private readonly payoutTransactionRepo: Repository<PayoutTransactionEntity>,
    private readonly escrowRepo: Repository<EscrowAccountEntity>,
    private readonly ledgerRepo: Repository<LedgerEntryEntity>,
    private readonly payoutService: PayoutService,
    private readonly paymentGatewayService: PaymentGatewayService,
    private readonly notificationService: NotificationService,
    private readonly config: GlobalConfig,
  ) {}

  async execute(input: ProcessPayoutBatchJobInput): Promise<ProcessPayoutBatchJobResult> {
    const startTime = Date.now();
    
    try {
      // Load the batch with transactions
      const batch = await this.payoutBatchRepo.findOne({
        where: { id: input.batchId },
        relations: ['transactions'],
      });

      if (!batch) {
        throw new Error(`Payout batch ${input.batchId} not found`);
      }

      if (batch.status !== 'pending' && !input.retryFailed) {
        throw new Error(`Batch ${input.batchId} is not in pending status. Current status: ${batch.status}`);
      }

      // Update batch status to processing
      batch.status = 'processing';
      await this.payoutBatchRepo.save(batch);

      const result: ProcessPayoutBatchJobResult = {
        success: false,
        batchId: input.batchId,
        processedCount: 0,
        successCount: 0,
        failureCount: 0,
        errors: [],
        totalAmountCents: batch.totalAmountCents,
        gatewayFeesCents: 0,
        netPayoutCents: 0,
      };

      const organizerId = batch.metadata?.organizerId as string;

      // Process each transaction
      for (const transaction of batch.transactions) {
        // Skip successful transactions unless retrying all
        if (transaction.status === 'sent' && !input.retryFailed) {
          continue;
        }

        // Reset failed transactions to pending for retry
        if (transaction.status === 'failed' && input.retryFailed) {
          transaction.status = 'pending';
          transaction.failureReason = null;
          transaction.gatewayReference = null;
          await this.payoutTransactionRepo.save(transaction);
        }

        result.processedCount++;

        try {
          await this.processSingleTransaction(transaction, organizerId);
          result.successCount++;
          
          // Calculate gateway fees (mock calculation)
          const gatewayFeeCents = Math.floor(transaction.amountCents * 0.02); // 2% gateway fee
          result.gatewayFeesCents += gatewayFeeCents;
          result.netPayoutCents += (transaction.amountCents - gatewayFeeCents);
          
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
        result.success = true;
      } else if (result.successCount === 0) {
        batch.status = 'failed';
        result.success = false;
      } else {
        batch.status = 'sent'; // Partial success
        result.success = true;
      }

      await this.payoutBatchRepo.save(batch);

      // Send notifications
      await this.sendCompletionNotifications(batch, result, organizerId);

      // Log completion
      const duration = Date.now() - startTime;
      console.log(`Payout batch ${input.batchId} processed in ${duration}ms`, {
        success: result.success,
        processedCount: result.processedCount,
        successCount: result.successCount,
        failureCount: result.failureCount,
      });

      return result;

    } catch (error) {
      // Mark batch as failed on critical errors
      try {
        const batch = await this.payoutBatchRepo.findOne({
          where: { id: input.batchId },
        });
        if (batch) {
          batch.status = 'failed';
          await this.payoutBatchRepo.save(batch);
        }
      } catch (saveError) {
        console.error('Failed to update batch status after error:', saveError);
      }

      throw error;
    }
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
        throw new Error(`Escrow account not found for organizer ${organizerId}`);
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
          processedBy: 'worker',
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
            processedBy: 'worker',
          },
        });

        await ledgerRepo.save(feeLedger);
      }
    });
  }

  private async sendCompletionNotifications(
    batch: PayoutBatchEntity,
    result: ProcessPayoutBatchJobResult,
    organizerId: string
  ): Promise<void> {
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
        gatewayFeesCents: result.gatewayFeesCents,
        netPayoutCents: result.netPayoutCents,
      },
      {
        tournamentId: undefined, // Payout notifications don't have tournament context
      }
    );

    // Send notification to finance team on failures
    if (result.failureCount > 0) {
      // In a real implementation, this would send to a finance team email or notification
      console.warn(`Payout batch ${batch.id} had ${result.failureCount} failed transactions:`, result.errors);
    }
  }

  // Helper method to create a job instance (for dependency injection)
  static create(
    payoutBatchRepo: Repository<PayoutBatchEntity>,
    payoutTransactionRepo: Repository<PayoutTransactionEntity>,
    escrowRepo: Repository<EscrowAccountEntity>,
    ledgerRepo: Repository<LedgerEntryEntity>,
    payoutService: PayoutService,
    paymentGatewayService: PaymentGatewayService,
    notificationService: NotificationService,
    config: GlobalConfig
  ): ProcessPayoutBatchJob {
    return new ProcessPayoutBatchJob(
      payoutBatchRepo,
      payoutTransactionRepo,
      escrowRepo,
      ledgerRepo,
      payoutService,
      paymentGatewayService,
      notificationService,
      config
    );
  }
}
