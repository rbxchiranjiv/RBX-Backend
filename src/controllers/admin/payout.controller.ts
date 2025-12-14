import { Request, Response } from 'express';
import { Repository } from 'typeorm';
import { 
  PayoutBatchEntity, 
  PayoutTransactionEntity,
  EscrowAccountEntity,
  UserEntity,
  UserRole 
} from '../../database/entities';
import { PayoutService } from '../../services/payout.service';
import { WebhookEventEntity } from '../../database/entities/webhook-event.entity';
import { NotFoundError, ValidationError, AuthorizationError } from '../../services/errors';

export class AdminPayoutController {
  constructor(
    private readonly payoutBatchRepo: Repository<PayoutBatchEntity>,
    private readonly payoutTransactionRepo: Repository<PayoutTransactionEntity>,
    private readonly escrowRepo: Repository<EscrowAccountEntity>,
    private readonly webhookEventRepo: Repository<WebhookEventEntity>,
    private readonly payoutService: PayoutService,
  ) {}

  // POST /api/v1/admin/payouts/create
  createPayoutBatch = async (req: Request, res: Response) => {
    try {
      const actor = req.user as any;
      
      // Only admins can create payout batches
      if (actor.role !== UserRole.ADMIN) {
        throw new AuthorizationError('Only admins can create payout batches');
      }

      const { organizerId, amountCents, currency, destinationInfo } = req.body;

      const batch = await this.payoutService.schedulePayout({
        organizerId,
        amountCents,
        currency: currency || 'USD',
        destinationInfo,
      }, actor.id);

      return res.status(201).json({ batch });
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return res.status(403).json({ error: (error as Error).message });
      }
      return res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  // POST /api/v1/admin/payouts/:batchId/process
  processPayoutBatch = async (req: Request, res: Response) => {
    try {
      const { batchId } = req.params;
      const actor = req.user as any;
      
      // Only admins can process payout batches
      if (actor.role !== UserRole.ADMIN) {
        throw new AuthorizationError('Only admins can process payout batches');
      }

      const result = await this.payoutService.processPayoutBatch(batchId);

      return res.status(200).json({ result });
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return res.status(403).json({ error: (error as Error).message });
      }
      return res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  // GET /api/v1/admin/payouts/:batchId
  getPayoutBatch = async (req: Request, res: Response) => {
    try {
      const { batchId } = req.params;
      const actor = req.user as any;
      
      // Only admins can view payout batches
      if (actor.role !== UserRole.ADMIN) {
        throw new AuthorizationError('Only admins can view payout batches');
      }

      const batch = await this.payoutService.getBatch(batchId);

      if (!batch) {
        throw new NotFoundError('PayoutBatch', batchId);
      }

      return res.status(200).json({ batch });
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return res.status(403).json({ error: (error as Error).message });
      }
      if (error instanceof NotFoundError) {
        return res.status(404).json({ error: (error as Error).message });
      }
      return res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  };
}
