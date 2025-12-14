import { Request, Response } from 'express';
import { Repository } from 'typeorm';
import { 
  PaymentRecordEntity, 
  EscrowAccountEntity, 
  TournamentEntity,
  UserEntity,
  UserRole 
} from '../database/entities';
import { EscrowService } from '../services/escrow.service';
import { WebhookService } from '../services/webhook.service';
import { NotificationService } from '../services/notification.service';
import { NotFoundError, ValidationError, AuthorizationError } from '../services/errors';

export class PaymentController {
  constructor(
    private readonly paymentRepo: Repository<PaymentRecordEntity>,
    private readonly escrowRepo: Repository<EscrowAccountEntity>,
    private readonly tournamentRepo: Repository<TournamentEntity>,
    private readonly userRepo: Repository<UserEntity>,
    private readonly escrowService: EscrowService,
    private readonly webhookService: WebhookService,
    private readonly notificationService: NotificationService,
  ) {}

  // POST /api/v1/payments/webhook/:gateway
  handleWebhook = async (req: Request, res: Response) => {
    try {
      const { gateway } = req.params;
      const payload = req.body;

      // Simple webhook processing for now
      const result = await this.webhookService.handleGatewayEvent({
        gateway,
        eventId: payload.eventId || 'unknown',
        payload,
        signature: req.headers['x-razorpay-signature'] as string,
        headers: req.headers as Record<string, string>,
      });

      if (result.duplicate) {
        return res.status(200).json({ message: 'Duplicate webhook event ignored' });
      }

      if (!result.processed) {
        return res.status(400).json({ error: result.error || 'Webhook processing failed' });
      }

      return res.status(200).json({ message: 'Webhook processed successfully' });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  // GET /api/v1/escrow/:organizerId
  getEscrowBalance = async (req: Request, res: Response) => {
    try {
      const { organizerId } = req.params;
      const actor = req.user as any;

      // Check if user is the organizer or admin
      const isOwner = organizerId === actor.id;
      const isAdmin = actor.role === UserRole.ADMIN;

      if (!isOwner && !isAdmin) {
        throw new AuthorizationError('You can only view your own escrow balance');
      }

      const escrow = await this.escrowRepo.findOne({
        where: { ownerUserId: organizerId },
      });

      if (!escrow) {
        return res.status(200).json({
          message: 'No escrow account found',
          balanceCents: 0,
          lockedCents: 0,
          availableCents: 0,
          currency: 'USD',
          ledgerEntries: [],
        });
      }

      const balance = await this.escrowService.getBalance(escrow.id);
      const ledgerEntries = await this.escrowService.getLedgerEntries(escrow.id);

      return res.status(200).json({
        ...balance,
        ledgerEntries,
      });
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return res.status(403).json({ error: (error as Error).message });
      }
      return res.status(400).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  };
}
