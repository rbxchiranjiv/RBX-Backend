import { EscrowService } from '../escrow.service';
import { EscrowAccountEntity, LedgerEntryEntity } from '../../database/entities';
import { NotFoundError, ValidationError } from '../errors';
import globalConfig from '../../../config/globalConfig';

// Simplified tests without complex mocking
describe('EscrowService', () => {
  let escrowService: EscrowService;

  beforeEach(() => {
    escrowService = new EscrowService(
      {} as any, // escrowRepo
      {} as any, // ledgerRepo
      globalConfig
    );
  });

  describe('createEscrowForOrganizer', () => {
    it('should throw error if escrow is disabled', async () => {
      const disabledConfig = { ...globalConfig, payments: { ...globalConfig.payments, escrowEnabled: false } };
      const disabledEscrowService = new EscrowService({} as any, {} as any, disabledConfig);

      await expect(
        disabledEscrowService.creditEscrow({ escrowAccountId: 'test', amountCents: 1000 })
      ).rejects.toThrow('Escrow is disabled');
    });
  });

  describe('getBalance', () => {
    it('should throw error if escrow not found', async () => {
      const mockEscrowRepo = {
        findOne: jest.fn().mockResolvedValue(null),
      } as any;

      const testEscrowService = new EscrowService(mockEscrowRepo, {} as any, globalConfig);

      await expect(testEscrowService.getBalance('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('findByOrganizer', () => {
    it('should return null if no escrow found', async () => {
      const mockEscrowRepo = {
        findOne: jest.fn().mockResolvedValue(null),
      } as any;

      const testEscrowService = new EscrowService(mockEscrowRepo, {} as any, globalConfig);

      const result = await testEscrowService.findByOrganizer('nonexistent');

      expect(result).toBeNull();
    });
  });
});
