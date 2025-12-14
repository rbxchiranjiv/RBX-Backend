import { PayoutService } from '../payout.service';
import { 
  PayoutBatchEntity, 
  PayoutTransactionEntity, 
  EscrowAccountEntity,
  LedgerEntryEntity,
  UserEntity 
} from '../../database/entities';
import { NotFoundError, ValidationError } from '../errors';
import globalConfig from '../../../config/globalConfig';

// Simplified tests without complex mocking
describe('PayoutService', () => {
  let payoutService: PayoutService;

  beforeEach(() => {
    payoutService = new PayoutService(
      {} as any, // payoutBatchRepo
      {} as any, // payoutTransactionRepo
      {} as any, // escrowRepo
      {} as any, // ledgerRepo
      {} as any, // paymentGatewayService
      {} as any, // notificationService
      globalConfig
    );
  });

  describe('schedulePayout', () => {
    it('should throw error for insufficient balance', async () => {
      const mockEscrowRepo = {
        findOne: jest.fn().mockResolvedValue({ 
          balanceCents: 30000, 
          lockedCents: 10000 
        }), // Only 20000 available
      } as any;

      const testPayoutService = new PayoutService(
        {} as any,
        {} as any,
        mockEscrowRepo,
        {} as any,
        {} as any,
        {} as any,
        globalConfig
      );

      await expect(
        testPayoutService.schedulePayout({
          organizerId: 'org-123',
          amountCents: 50000, // More than available
          currency: 'USD',
          destinationInfo: { accountIdentifier: 'acc-456' },
        }, 'admin-123')
      ).rejects.toThrow('Insufficient available balance for payout');
    });

    it('should throw error for minimum payout amount', async () => {
      const mockEscrowRepo = {
        findOne: jest.fn().mockResolvedValue({ 
          balanceCents: 10000, 
          lockedCents: 0 
        }),
      } as any;

      const testPayoutService = new PayoutService(
        {} as any,
        {} as any,
        mockEscrowRepo,
        {} as any,
        {} as any,
        {} as any,
        globalConfig
      );

      await expect(
        testPayoutService.schedulePayout({
          organizerId: 'org-123',
          amountCents: 50, // Below minimum of 100 cents
          currency: 'USD',
          destinationInfo: { accountIdentifier: 'acc-456' },
        }, 'admin-123')
      ).rejects.toThrow('Minimum payout amount is 100 cents');
    });

    it('should throw error if no escrow account found', async () => {
      const mockEscrowRepo = {
        findOne: jest.fn().mockResolvedValue(null),
      } as any;

      const testPayoutService = new PayoutService(
        {} as any,
        {} as any,
        mockEscrowRepo,
        {} as any,
        {} as any,
        {} as any,
        globalConfig
      );

      await expect(
        testPayoutService.schedulePayout({
          organizerId: 'org-123',
          amountCents: 50000,
          currency: 'USD',
          destinationInfo: { accountIdentifier: 'acc-456' },
        }, 'admin-123')
      ).rejects.toThrow('EscrowAccount');
    });
  });

  describe('processPayoutBatch', () => {
    it('should throw error if batch not found', async () => {
      const mockBatchRepo = {
        findOne: jest.fn().mockResolvedValue(null),
      } as any;

      const testPayoutService = new PayoutService(
        mockBatchRepo,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        globalConfig
      );

      await expect(testPayoutService.processPayoutBatch('nonexistent')).rejects.toThrow('PayoutBatch');
    });

    it('should throw error if batch not in pending status', async () => {
      const mockBatchRepo = {
        findOne: jest.fn().mockResolvedValue({ id: 'batch-123', status: 'processing' }),
      } as any;

      const testPayoutService = new PayoutService(
        mockBatchRepo,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        globalConfig
      );

      await expect(testPayoutService.processPayoutBatch('batch-123')).rejects.toThrow('Batch can only be processed when status is pending');
    });
  });

  describe('retryFailedTransactions', () => {
    it('should throw error if no failed transactions', async () => {
      const mockBatchRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 'batch-123',
          status: 'sent',
          transactions: [
            { id: 'txn-123', amountCents: 50000, status: 'sent' },
          ],
        }),
      } as any;

      const testPayoutService = new PayoutService(
        mockBatchRepo,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        globalConfig
      );

      await expect(testPayoutService.retryFailedTransactions('batch-123')).rejects.toThrow('No failed transactions to retry');
    });
  });

  describe('getBatch', () => {
    it('should return null if batch not found', async () => {
      const mockBatchRepo = {
        findOne: jest.fn().mockResolvedValue(null),
      } as any;

      const testPayoutService = new PayoutService(
        mockBatchRepo,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        globalConfig
      );

      const result = await testPayoutService.getBatch('nonexistent');

      expect(result).toBeNull();
    });
  });
});
