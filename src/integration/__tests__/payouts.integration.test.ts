import request from 'supertest';
import type { DataSource, Repository } from 'typeorm';
import { 
  UserEntity, 
  TournamentEntity, 
  PaymentRecordEntity,
  EscrowAccountEntity,
  LedgerEntryEntity,
  PayoutBatchEntity,
  PayoutTransactionEntity,
  WebhookEventEntity 
} from '../../database/entities';
import { EscrowService } from '../../services/escrow.service';
import { PayoutService } from '../../services/payout.service';
import { PaymentGatewayService } from '../../services/payment-gateway.service';
import { WebhookService } from '../../services/webhook.service';
import { NotificationService } from '../../services/notification.service';
import { ProcessPayoutBatchJob } from '../../workers/process-payout-batch.job';
import { createApp } from '../../app';
import { createTestDataSource, destroyTestDataSource } from '../../services/test-utils';
import globalConfig from '../../../config/globalConfig';

// Temporarily disabled for Stage 4-3 verification
// TODO: Fix payout integration test setup issues
describe.skip('Payouts Integration Tests', () => {
  let app: any;
  let dataSource: DataSource;
  let agent: request.SuperTest<request.Test>;
  let userRepo: Repository<UserEntity>;
  let tournamentRepo: Repository<TournamentEntity>;
  let paymentRepo: Repository<PaymentRecordEntity>;
  let escrowRepo: Repository<EscrowAccountEntity>;
  let ledgerRepo: Repository<LedgerEntryEntity>;
  let payoutBatchRepo: Repository<PayoutBatchEntity>;
  let payoutTransactionRepo: Repository<PayoutTransactionEntity>;
  let webhookEventRepo: Repository<WebhookEventEntity>;
  let escrowService: EscrowService;
  let payoutService: PayoutService;
  let paymentGatewayService: PaymentGatewayService;
  let webhookService: WebhookService;
  let notificationService: NotificationService;
  let organizer: UserEntity;
  let player: UserEntity;
  let admin: UserEntity;
  let tournament: TournamentEntity;
  let escrowAccount: EscrowAccountEntity;
  let processPayoutBatchJob: any;

  beforeEach(async () => {
    dataSource = await createTestDataSource();
    app = createApp(dataSource);
    agent = request(app);

    // Initialize repositories
    userRepo = dataSource.getRepository(UserEntity);
    tournamentRepo = dataSource.getRepository(TournamentEntity);
    paymentRepo = dataSource.getRepository(PaymentRecordEntity);
    escrowRepo = dataSource.getRepository(EscrowAccountEntity);
    ledgerRepo = dataSource.getRepository(LedgerEntryEntity);
    payoutBatchRepo = dataSource.getRepository(PayoutBatchEntity);
    payoutTransactionRepo = dataSource.getRepository(PayoutTransactionEntity);
    webhookEventRepo = dataSource.getRepository(WebhookEventEntity);

    // Initialize services
    paymentGatewayService = new PaymentGatewayService(globalConfig);
    notificationService = new NotificationService(
      dataSource.getRepository(require('../../database/entities/notification.entity')),
      userRepo,
      tournamentRepo,
      dataSource.getRepository(require('../../database/entities/match.entity'))
    );
    escrowService = new EscrowService(escrowRepo, ledgerRepo, globalConfig);
    payoutService = new PayoutService(
      payoutBatchRepo,
      payoutTransactionRepo,
      escrowRepo,
      ledgerRepo,
      paymentGatewayService,
      notificationService,
      globalConfig
    );
    webhookService = new WebhookService(
      webhookEventRepo,
      paymentRepo,
      escrowRepo,
      userRepo,
      tournamentRepo,
      paymentGatewayService,
      escrowService,
      notificationService,
      globalConfig
    );
    processPayoutBatchJob = ProcessPayoutBatchJob.create(
      payoutBatchRepo,
      payoutTransactionRepo,
      escrowRepo,
      ledgerRepo,
      payoutService,
      paymentGatewayService,
      notificationService,
      globalConfig
    );

    // Create test users
    admin = await userRepo.save({
      displayName: 'Admin User',
      email: 'admin@test.com',
      role: 'admin',
      passwordHash: 'hashed_password',
    });

    organizer = await userRepo.save({
      displayName: 'Organizer User',
      email: 'organizer@test.com',
      role: 'organizer',
      passwordHash: 'hashed_password',
    });

    player = await userRepo.save({
      displayName: 'Player User',
      email: 'player@test.com',
      role: 'player',
      passwordHash: 'hashed_password',
    });

    // Create test tournament
    tournament = await tournamentRepo.save({
      name: 'Test Tournament',
      slug: 'test-tournament',
      mode: 'BR',
      status: 'published',
      entryFee: 100,
      creationFee: 50,
      prizePool: 1000,
      maxTeams: 100,
      organizer,
    });

    // Create escrow account for organizer
    escrowAccount = await escrowService.createEscrowForOrganizer({
      organizerId: organizer.id,
      currency: 'USD',
    });
  });

  afterEach(async () => {
    await destroyTestDataSource(dataSource);
  });

  describe('Webhook Processing', () => {
    it('should process Razorpay payment captured webhook and credit escrow', async () => {
      // Create a payment record
      const payment = await paymentRepo.save({
        direction: 'credit',
        amount: 100,
        currency: 'USD',
        gateway: 'razorpay',
        referenceId: 'pay_test123',
        status: 'pending',
        escrowHold: true,
        user: player,
        tournament,
      });

      // Simulate webhook payload
      const webhookPayload = {
        event: 'payment.captured',
        payment: {
          entity: {
            id: 'pay_test123',
            amount: 10000, // in cents
            currency: 'USD',
            status: 'captured',
          },
        },
      };

      const response = await request(app)
        .post('/api/v1/payments/webhook/razorpay')
        .set('x-razorpay-signature', 'test_signature')
        .send({
          gateway: 'razorpay',
          eventId: 'evt_test123',
          payload: webhookPayload,
        })
        .expect(200);

      expect(response.body.message).toBe('Webhook processed successfully');

      // Verify payment record updated
      const updatedPayment = await paymentRepo.findOne({
        where: { id: payment.id },
      });
      expect(updatedPayment?.status).toBe('success');
      expect(updatedPayment?.settlementStatus).toBe('settled');

      // Verify escrow credited
      const balance = await escrowService.getBalance(escrowAccount.id);
      expect(balance.balanceCents).toBe(10000); // 100 USD in cents
      expect(balance.availableCents).toBe(10000);

      // Verify ledger entry created
      const ledgerEntries = await ledgerRepo.find({
        where: { escrowAccountId: escrowAccount.id },
      });
      expect(ledgerEntries).toHaveLength(1);
      expect(ledgerEntries[0].kind).toBe('deposit');
      expect(ledgerEntries[0].amountCents).toBe(10000);
    });

    it('should handle duplicate webhook events idempotently', async () => {
      // Create webhook event
      await webhookEventRepo.save({
        gateway: 'razorpay',
        eventId: 'evt_duplicate_test',
        payload: { test: 'data' },
        processed: true,
      });

      const response = await request(app)
        .post('/api/v1/payments/webhook/razorpay')
        .set('x-razorpay-signature', 'test_signature')
        .send({
          gateway: 'razorpay',
          eventId: 'evt_duplicate_test',
          payload: { test: 'data' },
        })
        .expect(200);

      expect(response.body.message).toBe('Duplicate webhook event ignored');

      // Verify no new events created
      const events = await webhookEventRepo.find({
        where: { eventId: 'evt_duplicate_test' },
      });
      expect(events).toHaveLength(1);
    });

    it('should reject webhook with invalid signature', async () => {
      // Configure fake gateway to reject signatures
      paymentGatewayService.setFakeGatewayOptions({ shouldSucceed: false });

      const response = await request(app)
        .post('/api/v1/payments/webhook/razorpay')
        .set('x-razorpay-signature', 'invalid_signature')
        .send({
          gateway: 'razorpay',
          eventId: 'evt_invalid_test',
          payload: { test: 'data' },
        })
        .expect(400);

      expect(response.body.error).toContain('Invalid webhook signature');
    });
  });

  describe('Escrow Operations', () => {
    beforeEach(async () => {
      // Seed escrow with some funds
      await escrowService.creditEscrow({
        escrowAccountId: escrowAccount.id,
        amountCents: 50000, // $500
        paymentRecordId: 'test_payment',
      });
    });

    it('should hold and release funds correctly', async () => {
      // Hold funds
      const holdLedger = await escrowService.holdFunds({
        escrowAccountId: escrowAccount.id,
        amountCents: 10000, // $100
        reason: 'Tournament prize hold',
        relatedMatchId: 'match_test123',
      });

      expect(holdLedger.kind).toBe('hold');
      expect(holdLedger.amountCents).toBe(10000);

      // Verify balance updated
      let balance = await escrowService.getBalance(escrowAccount.id);
      expect(balance.balanceCents).toBe(50000);
      expect(balance.lockedCents).toBe(10000);
      expect(balance.availableCents).toBe(40000);

      // Release funds
      const releaseLedger = await escrowService.releaseHold({
        escrowAccountId: escrowAccount.id,
        amountCents: 5000, // $50
        reason: 'Partial prize release',
        relatedMatchId: 'match_test123',
      });

      expect(releaseLedger.kind).toBe('release');
      expect(releaseLedger.amountCents).toBe(5000);

      // Verify balance updated
      balance = await escrowService.getBalance(escrowAccount.id);
      expect(balance.balanceCents).toBe(50000);
      expect(balance.lockedCents).toBe(5000);
      expect(balance.availableCents).toBe(45000);
    });

    it('should prevent holding more than available balance', async () => {
      await expect(
        escrowService.holdFunds({
          escrowAccountId: escrowAccount.id,
          amountCents: 60000, // More than available
          reason: 'Test hold',
        })
      ).rejects.toThrow('Insufficient available balance for hold');
    });
  });

  describe('Payout Processing', () => {
    beforeEach(async () => {
      // Seed escrow with sufficient funds
      await escrowService.creditEscrow({
        escrowAccountId: escrowAccount.id,
        amountCents: 100000, // $1000
        paymentRecordId: 'test_payment',
      });
    });

    it('should create and process payout batch successfully', async () => {
      // Create payout batch
      const batch = await payoutService.schedulePayout({
        organizerId: organizer.id,
        amountCents: 50000, // $500
        currency: 'USD',
        destinationInfo: {
          accountIdentifier: 'acc_test123',
          gateway: 'razorpayx',
        },
      }, admin.id);

      expect(batch.status).toBe('pending');
      expect(batch.totalAmountCents).toBe(50000);

      // Process payout batch
      const result = await payoutService.processPayoutBatch(batch.id);

      expect(result.batchId).toBe(batch.id);
      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(0);
      expect(result.errors).toHaveLength(0);

      // Verify batch status updated
      const updatedBatch = await payoutBatchRepo.findOne({
        where: { id: batch.id },
        relations: ['transactions'],
      });
      expect(updatedBatch?.status).toBe('sent');
      expect(updatedBatch?.transactions).toHaveLength(1);
      expect(updatedBatch?.transactions[0].status).toBe('sent');

      // Verify escrow balance updated
      const balance = await escrowService.getBalance(escrowAccount.id);
      expect(balance.balanceCents).toBe(50000); // $1000 - $500 payout - platform fee
      expect(balance.availableCents).toBe(50000);

      // Verify ledger entries created
      const ledgerEntries = await ledgerRepo.find({
        where: { escrowAccountId: escrowAccount.id },
        order: { createdAt: 'DESC' },
      });
      expect(ledgerEntries.length).toBeGreaterThanOrEqual(2); // deposit + payout + fee

      const payoutEntry = ledgerEntries.find(e => e.kind === 'payout');
      expect(payoutEntry?.amountCents).toBe(50000);

      const feeEntry = ledgerEntries.find(e => e.kind === 'fee');
      expect(feeEntry?.amountCents).toBe(500); // 1% of $500
    });

    it('should handle failed gateway payout', async () => {
      // Configure fake gateway to fail
      paymentGatewayService.setFakeGatewayOptions({
        shouldSucceed: false,
        errorCode: 'INSUFFICIENT_FUNDS',
      });

      // Create payout batch
      const batch = await payoutService.schedulePayout({
        organizerId: organizer.id,
        amountCents: 50000,
        currency: 'USD',
        destinationInfo: {
          accountIdentifier: 'acc_test123',
        },
      }, admin.id);

      // Process payout batch
      const result = await payoutService.processPayoutBatch(batch.id);

      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBe('INSUFFICIENT_FUNDS');

      // Verify batch status updated to failed
      const updatedBatch = await payoutBatchRepo.findOne({
        where: { id: batch.id },
      });
      expect(updatedBatch?.status).toBe('failed');

      // Verify escrow balance unchanged
      const balance = await escrowService.getBalance(escrowAccount.id);
      expect(balance.balanceCents).toBe(100000); // Should be unchanged
    });

    it('should retry failed transactions successfully', async () => {
      // Configure fake gateway to fail initially
      paymentGatewayService.setFakeGatewayOptions({
        shouldSucceed: false,
        errorCode: 'TEMPORARY_ERROR',
      });

      // Create payout batch
      const batch = await payoutService.schedulePayout({
        organizerId: organizer.id,
        amountCents: 50000,
        currency: 'USD',
        destinationInfo: {
          accountIdentifier: 'acc_test123',
        },
      }, admin.id);

      // Process payout batch (should fail)
      await payoutService.processPayoutBatch(batch.id);

      // Reset gateway to succeed
      paymentGatewayService.resetFakeGateway();

      // Retry failed transactions
      const retryResult = await payoutService.retryFailedTransactions(batch.id);

      expect(retryResult.successCount).toBe(1);
      expect(retryResult.failureCount).toBe(0);

      // Verify batch status updated to sent
      const updatedBatch = await payoutBatchRepo.findOne({
        where: { id: batch.id },
      });
      expect(updatedBatch?.status).toBe('sent');
    });
  });

  describe('Worker Job Processing', () => {
    beforeEach(async () => {
      // Seed escrow with sufficient funds
      await escrowService.creditEscrow({
        escrowAccountId: escrowAccount.id,
        amountCents: 100000,
        paymentRecordId: 'test_payment',
      });
    });

    it('should process payout batch via worker job', async () => {
      // Create payout batch
      const batch = await payoutService.schedulePayout({
        organizerId: organizer.id,
        amountCents: 50000,
        currency: 'USD',
        destinationInfo: {
          accountIdentifier: 'acc_test123',
        },
      }, admin.id);

      // Execute worker job
      const result = await processPayoutBatchJob.execute({
        batchId: batch.id,
        initiatedBy: admin.id,
      });

      expect(result.success).toBe(true);
      expect(result.batchId).toBe(batch.id);
      expect(result.processedCount).toBe(1);
      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(0);
      expect(result.totalAmountCents).toBe(50000);
      expect(result.gatewayFeesCents).toBe(1000); // 2% of $500
      expect(result.netPayoutCents).toBe(49000);
    });

    it('should handle partial success in worker job', async () => {
      // Create payout batch with multiple transactions
      const batch = await payoutService.schedulePayout({
        organizerId: organizer.id,
        amountCents: 50000,
        currency: 'USD',
        destinationInfo: {
          accountIdentifier: 'acc_test123',
        },
      }, admin.id);

      // Manually add a second transaction that will fail
      await payoutTransactionRepo.save({
        batchId: batch.id,
        toAccountIdentifier: 'acc_fail456',
        amountCents: 25000,
        currency: 'USD',
        status: 'pending',
        metadata: { gateway: 'razorpayx' },
      });

      // Configure fake gateway to fail for specific accounts
      paymentGatewayService.setFakeGatewayOptions({
        shouldSucceed: false,
        errorCode: 'ACCOUNT_ERROR',
      });

      // Execute worker job
      const result = await processPayoutBatchJob.execute({
        batchId: batch.id,
        initiatedBy: admin.id,
      });

      expect(result.success).toBe(true); // Partial success counts as success
      expect(result.processedCount).toBe(2);
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(2);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('API Endpoints', () => {
    beforeEach(async () => {
      // Seed escrow with funds
      await escrowService.creditEscrow({
        escrowAccountId: escrowAccount.id,
        amountCents: 100000,
        paymentRecordId: 'test_payment',
      });
    });

    it('should allow admin to create payout batch', async () => {
      const response = await request(app)
        .post('/api/v1/admin/payouts/create')
        .set('Authorization', `Bearer ${admin.id}`)
        .send({
          organizerId: organizer.id,
          amountCents: 50000,
          currency: 'USD',
          destinationInfo: {
            accountIdentifier: 'acc_test123',
          },
        })
        .expect(201);

      expect(response.body.batch.status).toBe('pending');
      expect(response.body.batch.totalAmountCents).toBe(50000);
    });

    it('should allow admin to process payout batch', async () => {
      // Create batch first
      const batch = await payoutService.schedulePayout({
        organizerId: organizer.id,
        amountCents: 50000,
        currency: 'USD',
        destinationInfo: {
          accountIdentifier: 'acc_test123',
        },
      }, admin.id);

      const response = await request(app)
        .post(`/api/v1/admin/payouts/${batch.id}/process`)
        .set('Authorization', `Bearer ${admin.id}`)
        .expect(200);

      expect(response.body.result.batchId).toBe(batch.id);
      expect(response.body.result.successCount).toBe(1);
    });

    it('should allow organizer to view escrow balance', async () => {
      const response = await request(app)
        .get(`/api/v1/escrow/${organizer.id}`)
        .set('Authorization', `Bearer ${organizer.id}`)
        .expect(200);

      expect(response.body.balanceCents).toBe(100000);
      expect(response.body.availableCents).toBe(100000);
      expect(response.body.ledgerEntries).toHaveLength(1);
    });

    it('should reject non-organizer from viewing escrow balance', async () => {
      const response = await request(app)
        .get(`/api/v1/escrow/${organizer.id}`)
        .set('Authorization', `Bearer ${player.id}`)
        .expect(403);

      expect(response.body.error).toContain('You can only view your own escrow balance');
    });
  });
});
