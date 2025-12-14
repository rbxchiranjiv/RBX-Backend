import { EntityManager, Repository } from 'typeorm';
import type { GlobalConfig } from 'types/globalConfig';
import { 
  WebhookEventEntity, 
  PaymentRecordEntity, 
  EscrowAccountEntity,
  UserEntity,
  TournamentEntity 
} from '../database/entities';
import { PaymentGatewayService } from './payment-gateway.service';
import { EscrowService } from './escrow.service';
import { NotificationService } from './notification.service';
import { NotFoundError, ValidationError } from './errors';

export interface WebhookEventInput {
  gateway: string;
  eventId: string;
  payload: Record<string, unknown>;
  signature?: string;
  headers?: Record<string, string>;
}

export interface ProcessWebhookResult {
  processed: boolean;
  duplicate: boolean;
  error?: string;
}

export class WebhookService {
  constructor(
    private readonly webhookEventRepo: Repository<WebhookEventEntity>,
    private readonly paymentRecordRepo: Repository<PaymentRecordEntity>,
    private readonly escrowRepo: Repository<EscrowAccountEntity>,
    private readonly userRepo: Repository<UserEntity>,
    private readonly tournamentRepo: Repository<TournamentEntity>,
    private readonly paymentGatewayService: PaymentGatewayService,
    private readonly escrowService: EscrowService,
    private readonly notificationService: NotificationService,
    private readonly config: GlobalConfig,
  ) {}

  async handleGatewayEvent(input: WebhookEventInput): Promise<ProcessWebhookResult> {
    try {
      // Verify webhook signature
      if (input.signature && input.headers) {
        const verification = this.paymentGatewayService.verifyWebhookSignature(
          input.gateway,
          input.headers,
          JSON.stringify(input.payload)
        );

        if (!verification.valid) {
          return {
            processed: false,
            duplicate: false,
            error: verification.error || 'Invalid webhook signature',
          };
        }
      }

      // Check for duplicate event using unique constraint
      const existingEvent = await this.webhookEventRepo.findOne({
        where: { gateway: input.gateway, eventId: input.eventId },
      });

      if (existingEvent) {
        return {
          processed: false,
          duplicate: true,
          error: 'Duplicate webhook event',
        };
      }

      // Store webhook event
      const webhookEvent = this.webhookEventRepo.create({
        gateway: input.gateway,
        eventId: input.eventId,
        payload: input.payload,
        processed: false,
      });

      await this.webhookEventRepo.save(webhookEvent);

      // Process the webhook event
      await this.processWebhookEvent(webhookEvent);

      // Mark as processed
      webhookEvent.processed = true;
      webhookEvent.processedAt = new Date();
      await this.webhookEventRepo.save(webhookEvent);

      return {
        processed: true,
        duplicate: false,
      };

    } catch (error) {
      return {
        processed: false,
        duplicate: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async processWebhookEvent(webhookEvent: WebhookEventEntity): Promise<void> {
    const payload = webhookEvent.payload;
    const gateway = webhookEvent.gateway;

    // Map gateway-specific event format to our internal format
    switch (gateway) {
      case 'razorpay':
        await this.processRazorpayEvent(payload);
        break;
      case 'paytm':
        await this.processPaytmEvent(payload);
        break;
      case 'paypal':
        await this.processPaypalEvent(payload);
        break;
      default:
        throw new ValidationError(`Unsupported gateway: ${gateway}`);
    }
  }

  private async processRazorpayEvent(payload: Record<string, unknown>): Promise<void> {
    const event = payload.event as string;
    const paymentEntity = (payload as any).payment?.entity as any;

    if (!paymentEntity?.id) {
      throw new ValidationError('Invalid Razorpay webhook payload');
    }

    // Find payment record by reference ID
    const paymentRecord = await this.paymentRecordRepo.findOne({
      where: { referenceId: paymentEntity.id },
      relations: ['user', 'tournament'],
    });

    if (!paymentRecord) {
      throw new NotFoundError('PaymentRecord', `with reference ${paymentEntity.id}`);
    }

    // Update payment record with gateway response
    paymentRecord.gatewayResponse = payload;
    paymentRecord.gatewayEventId = payload.eventId as string;

    switch (event) {
      case 'payment.captured':
        await this.handlePaymentCaptured(paymentRecord, paymentEntity);
        break;
      case 'payment.failed':
        await this.handlePaymentFailed(paymentRecord, paymentEntity);
        break;
      case 'payment.refunded':
        await this.handlePaymentRefunded(paymentRecord, paymentEntity);
        break;
      default:
        // Log unhandled event type
        console.log(`Unhandled Razorpay event: ${event}`);
    }

    await this.paymentRecordRepo.save(paymentRecord);
  }

  private async processPaytmEvent(payload: Record<string, unknown>): Promise<void> {
    // TODO: Implement Paytm event processing
    console.log('Paytm webhook processing not implemented yet');
  }

  private async processPaypalEvent(payload: Record<string, unknown>): Promise<void> {
    // TODO: Implement PayPal event processing
    console.log('PayPal webhook processing not implemented yet');
  }

  private async handlePaymentCaptured(
    paymentRecord: PaymentRecordEntity,
    gatewayPayment: any
  ): Promise<void> {
    // Update payment status
    paymentRecord.status = 'success';
    paymentRecord.processedAt = new Date();
    paymentRecord.settlementStatus = 'settled';

    // Convert amount to cents (assuming gateway amount is in base currency)
    const amountCents = Math.round((gatewayPayment.amount || 0) * 100);

    // Credit to escrow if enabled
    if (this.config.payments.escrowEnabled && paymentRecord.tournament) {
      // Find or create escrow account for tournament organizer
      const organizerId = paymentRecord.tournament.organizer.id;
      let escrow = await this.escrowRepo.findOne({
        where: { ownerUserId: organizerId },
      });

      if (!escrow) {
        escrow = await this.escrowService.createEscrowForOrganizer({
          organizerId,
          currency: paymentRecord.currency,
        });
      }

      // Credit escrow
      await this.escrowService.creditEscrow({
        escrowAccountId: escrow.id,
        amountCents,
        paymentRecordId: paymentRecord.id,
        metadata: {
          gateway: 'razorpay',
          gatewayPaymentId: gatewayPayment.id,
        },
      });
    }

    // Send notification to user
    await this.notificationService.queue(
      paymentRecord.user.id,
      'paymentSuccess',
      'inApp',
      {
        amount: paymentRecord.amount,
        currency: paymentRecord.currency,
        referenceId: paymentRecord.referenceId,
      },
      {
        tournamentId: paymentRecord.tournament?.id,
      }
    );
  }

  private async handlePaymentFailed(
    paymentRecord: PaymentRecordEntity,
    gatewayPayment: any
  ): Promise<void> {
    // Update payment status
    paymentRecord.status = 'failed';
    paymentRecord.processedAt = new Date();
    paymentRecord.settlementStatus = 'failed';

    // Send notification to user
    await this.notificationService.queue(
      paymentRecord.user.id,
      'paymentFailed',
      'inApp',
      {
        amount: paymentRecord.amount,
        currency: paymentRecord.currency,
        referenceId: paymentRecord.referenceId,
        reason: gatewayPayment.error?.description || 'Payment failed',
      },
      {
        tournamentId: paymentRecord.tournament?.id,
      }
    );
  }

  private async handlePaymentRefunded(
    paymentRecord: PaymentRecordEntity,
    gatewayPayment: any
  ): Promise<void> {
    // Update payment status
    paymentRecord.status = 'refunded';
    paymentRecord.processedAt = new Date();
    paymentRecord.settlementStatus = 'reversed';

    // If escrow was used, create a refund ledger entry
    if (this.config.payments.escrowEnabled && paymentRecord.tournament) {
      const organizerId = paymentRecord.tournament.organizer.id;
      const escrow = await this.escrowRepo.findOne({
        where: { ownerUserId: organizerId },
      });

      if (escrow) {
        const amountCents = Math.round((gatewayPayment.amount || 0) * 100);
        
        // Debit from escrow (refund)
        await this.escrowService.debitEscrow({
          escrowAccountId: escrow.id,
          amountCents,
          kind: 'refund',
          metadata: {
            originalPaymentId: paymentRecord.id,
            gatewayRefundId: gatewayPayment.id,
          },
        });
      }
    }

    // Send notification to user
    await this.notificationService.queue(
      paymentRecord.user.id,
      'paymentRefunded',
      'inApp',
      {
        amount: paymentRecord.amount,
        currency: paymentRecord.currency,
        referenceId: paymentRecord.referenceId,
      },
      {
        tournamentId: paymentRecord.tournament?.id,
      }
    );
  }

  async listWebhookEvents(
    gateway?: string,
    processed?: boolean,
    limit = 50
  ): Promise<WebhookEventEntity[]> {
    const where: any = {};
    if (gateway) where.gateway = gateway;
    if (processed !== undefined) where.processed = processed;

    return this.webhookEventRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getWebhookEvent(eventId: string): Promise<WebhookEventEntity | null> {
    return this.webhookEventRepo.findOne({
      where: { id: eventId },
    });
  }

  async retryFailedWebhookEvent(eventId: string): Promise<ProcessWebhookResult> {
    const event = await this.webhookEventRepo.findOne({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundError('WebhookEvent', eventId);
    }

    if (event.processed) {
      return {
        processed: false,
        duplicate: false,
        error: 'Event already processed',
      };
    }

    try {
      await this.processWebhookEvent(event);
      
      event.processed = true;
      event.processedAt = new Date();
      await this.webhookEventRepo.save(event);

      return {
        processed: true,
        duplicate: false,
      };
    } catch (error) {
      return {
        processed: false,
        duplicate: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
