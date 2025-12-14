import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { WalletService } from '../wallet.service';
import { WalletEntity } from '../../database/entities/wallet.entity';
import { WalletTransactionEntity } from '../../database/entities/wallet-transaction.entity';
import { PaymentRecordEntity } from '../../database/entities/payment-record.entity';
import { Repository } from 'typeorm';
import { WalletCurrency, WalletStatus } from '../../database/entities/wallet.entity';
import { TransactionType, TransactionStatus } from '../../database/entities/wallet-transaction.entity';

describe('WalletService', () => {
  let service: WalletService;
  let walletRepo: Repository<WalletEntity>;
  let transactionRepo: Repository<WalletTransactionEntity>;
  let paymentRepo: Repository<PaymentRecordEntity>;
  let dataSource: DataSource;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: getRepositoryToken(WalletEntity),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(WalletTransactionEntity),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PaymentRecordEntity),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
    walletRepo = module.get<Repository<WalletEntity>>(getRepositoryToken(WalletEntity));
    transactionRepo = module.get<Repository<WalletTransactionEntity>>(getRepositoryToken(WalletTransactionEntity));
    paymentRepo = module.get<Repository<PaymentRecordEntity>>(getRepositoryToken(PaymentRecordEntity));
    dataSource = module.get<DataSource>(DataSource);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createWallet', () => {
    it('should create a new wallet', async () => {
      const userId = 'user-123';
      const currency = WalletCurrency.USD;
      const expectedWallet = { id: 'wallet-123', userId, currency, balance: 0, status: WalletStatus.ACTIVE };

      jest.spyOn(walletRepo, 'findOne').mockResolvedValue(null);
      jest.spyOn(walletRepo, 'create').mockReturnValue(expectedWallet as any);
      jest.spyOn(walletRepo, 'save').mockResolvedValue(expectedWallet as any);

      const result = await service.createWallet(userId, currency);

      expect(walletRepo.create).toHaveBeenCalledWith({
        userId,
        currency,
        balance: 0,
        lockedBalance: 0,
        availableBalance: 0,
        status: WalletStatus.ACTIVE,
      });
      expect(result).toEqual(expectedWallet);
    });

    it('should return existing wallet if already exists', async () => {
      const userId = 'user-123';
      const currency = WalletCurrency.USD;
      const existingWallet = { id: 'wallet-123', userId, currency };

      jest.spyOn(walletRepo, 'findOne').mockResolvedValue(existingWallet as any);

      const result = await service.createWallet(userId, currency);

      expect(walletRepo.findOne).toHaveBeenCalledWith({ where: { userId, currency } });
      expect(result).toEqual(existingWallet);
    });
  });

  describe('createTransaction', () => {
    it('should create a deposit transaction', async () => {
      const walletId = 'wallet-123';
      const type = TransactionType.DEPOSIT;
      const amount = 100;
      const wallet = { id: walletId, balance: 0, availableBalance: 0, lockedBalance: 0, status: WalletStatus.ACTIVE };
      const expectedTransaction = { id: 'tx-123', walletId, type, amount, balanceBefore: 0, balanceAfter: 100 };

      const mockTransaction = jest.fn().mockImplementation((callback) => {
        return callback({
          findOne: jest.fn().mockResolvedValue(wallet),
          save: jest.fn().mockResolvedValue(expectedTransaction),
        });
      });

      jest.spyOn(dataSource, 'transaction').mockImplementation(mockTransaction);
      jest.spyOn(transactionRepo, 'create').mockReturnValue(expectedTransaction as any);

      const result = await service.createTransaction(walletId, type, amount);

      expect(result).toEqual(expectedTransaction);
    });

    it('should throw error for insufficient funds', async () => {
      const walletId = 'wallet-123';
      const type = TransactionType.WITHDRAWAL;
      const amount = 100;
      const wallet = { id: walletId, balance: 50, availableBalance: 50, lockedBalance: 0, status: WalletStatus.ACTIVE };

      const mockTransaction = jest.fn().mockImplementation((callback) => {
        return callback({
          findOne: jest.fn().mockResolvedValue(wallet),
        });
      });

      jest.spyOn(dataSource, 'transaction').mockImplementation(mockTransaction);

      await expect(service.createTransaction(walletId, type, amount)).rejects.toThrow('Insufficient funds');
    });
  });
});
