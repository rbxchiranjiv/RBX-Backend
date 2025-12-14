import { EntityManager, Repository } from 'typeorm';
import type { GlobalConfig } from 'types/globalConfig';
import { EscrowAccountEntity, LedgerEntryEntity, PaymentRecordEntity, MatchEntity } from '../database/entities';
import { NotFoundError, ValidationError } from './errors';

export interface CreateEscrowInput {
  organizerId: string;
  currency?: string;
}

export interface CreditEscrowInput {
  escrowAccountId: string;
  amountCents: number;
  paymentRecordId?: string;
  metadata?: Record<string, unknown>;
}

export interface HoldFundsInput {
  escrowAccountId: string;
  amountCents: number;
  reason: string;
  relatedMatchId?: string;
}

export interface ReleaseHoldInput {
  escrowAccountId: string;
  amountCents: number;
  reason: string;
  relatedMatchId?: string;
}

export interface DebitEscrowInput {
  escrowAccountId: string;
  amountCents: number;
  kind: LedgerEntryEntity['kind'];
  metadata?: Record<string, unknown>;
}

export class EscrowService {
  constructor(
    private readonly escrowRepo: Repository<EscrowAccountEntity>,
    private readonly ledgerRepo: Repository<LedgerEntryEntity>,
    private readonly config: GlobalConfig,
  ) {}

  async createEscrowForOrganizer(input: CreateEscrowInput): Promise<EscrowAccountEntity> {
    const existing = await this.escrowRepo.findOne({
      where: { ownerUserId: input.organizerId },
    });
    
    if (existing) {
      return existing;
    }

    const escrow = this.escrowRepo.create({
      ownerUserId: input.organizerId,
      balanceCents: 0,
      lockedCents: 0,
      currency: input.currency || 'USD',
    });

    return this.escrowRepo.save(escrow);
  }

  async creditEscrow(input: CreditEscrowInput): Promise<LedgerEntryEntity> {
    if (!this.config.payments.escrowEnabled) {
      throw new ValidationError('Escrow is disabled');
    }

    return this.escrowRepo.manager.transaction(async manager => {
      const escrowRepo = manager.getRepository(EscrowAccountEntity);
      const ledgerRepo = manager.getRepository(LedgerEntryEntity);

      const escrow = await escrowRepo.findOne({
        where: { id: input.escrowAccountId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!escrow) {
        throw new NotFoundError('EscrowAccount', input.escrowAccountId);
      }

      // Update balance
      escrow.balanceCents += input.amountCents;
      await escrowRepo.save(escrow);

      // Create ledger entry
      const ledger = ledgerRepo.create({
        escrowAccountId: input.escrowAccountId,
        kind: 'deposit',
        amountCents: input.amountCents,
        currency: escrow.currency,
        relatedPaymentId: input.paymentRecordId,
        metadata: input.metadata || {},
      });

      return ledgerRepo.save(ledger);
    });
  }

  async holdFunds(input: HoldFundsInput): Promise<LedgerEntryEntity> {
    if (!this.config.payments.escrowEnabled) {
      throw new ValidationError('Escrow is disabled');
    }

    return this.escrowRepo.manager.transaction(async manager => {
      const escrowRepo = manager.getRepository(EscrowAccountEntity);
      const ledgerRepo = manager.getRepository(LedgerEntryEntity);

      const escrow = await escrowRepo.findOne({
        where: { id: input.escrowAccountId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!escrow) {
        throw new NotFoundError('EscrowAccount', input.escrowAccountId);
      }

      const availableBalance = escrow.balanceCents - escrow.lockedCents;
      if (availableBalance < input.amountCents) {
        throw new ValidationError('Insufficient available balance for hold');
      }

      // Update locked amount
      escrow.lockedCents += input.amountCents;
      await escrowRepo.save(escrow);

      // Create ledger entry
      const ledger = ledgerRepo.create({
        escrowAccountId: input.escrowAccountId,
        kind: 'hold',
        amountCents: input.amountCents,
        currency: escrow.currency,
        relatedMatchId: input.relatedMatchId,
        metadata: { reason: input.reason },
      });

      return ledgerRepo.save(ledger);
    });
  }

  async releaseHold(input: ReleaseHoldInput): Promise<LedgerEntryEntity> {
    if (!this.config.payments.escrowEnabled) {
      throw new ValidationError('Escrow is disabled');
    }

    return this.escrowRepo.manager.transaction(async manager => {
      const escrowRepo = manager.getRepository(EscrowAccountEntity);
      const ledgerRepo = manager.getRepository(LedgerEntryEntity);

      const escrow = await escrowRepo.findOne({
        where: { id: input.escrowAccountId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!escrow) {
        throw new NotFoundError('EscrowAccount', input.escrowAccountId);
      }

      if (escrow.lockedCents < input.amountCents) {
        throw new ValidationError('Insufficient locked funds to release');
      }

      // Update locked amount
      escrow.lockedCents -= input.amountCents;
      await escrowRepo.save(escrow);

      // Create ledger entry
      const ledger = ledgerRepo.create({
        escrowAccountId: input.escrowAccountId,
        kind: 'release',
        amountCents: input.amountCents,
        currency: escrow.currency,
        relatedMatchId: input.relatedMatchId,
        metadata: { reason: input.reason },
      });

      return ledgerRepo.save(ledger);
    });
  }

  async debitEscrow(input: DebitEscrowInput): Promise<LedgerEntryEntity> {
    if (!this.config.payments.escrowEnabled) {
      throw new ValidationError('Escrow is disabled');
    }

    return this.escrowRepo.manager.transaction(async manager => {
      const escrowRepo = manager.getRepository(EscrowAccountEntity);
      const ledgerRepo = manager.getRepository(LedgerEntryEntity);

      const escrow = await escrowRepo.findOne({
        where: { id: input.escrowAccountId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!escrow) {
        throw new NotFoundError('EscrowAccount', input.escrowAccountId);
      }

      const availableBalance = escrow.balanceCents - escrow.lockedCents;
      if (availableBalance < input.amountCents) {
        throw new ValidationError('Insufficient available balance for debit');
      }

      // Update balance
      escrow.balanceCents -= input.amountCents;
      await escrowRepo.save(escrow);

      // Create ledger entry
      const ledger = ledgerRepo.create({
        escrowAccountId: input.escrowAccountId,
        kind: input.kind,
        amountCents: input.amountCents,
        currency: escrow.currency,
        metadata: input.metadata || {},
      });

      return ledgerRepo.save(ledger);
    });
  }

  async getBalance(escrowAccountId: string): Promise<{
    balanceCents: number;
    lockedCents: number;
    availableCents: number;
    currency: string;
  }> {
    const escrow = await this.escrowRepo.findOne({
      where: { id: escrowAccountId },
    });

    if (!escrow) {
      throw new NotFoundError('EscrowAccount', escrowAccountId);
    }

    return {
      balanceCents: escrow.balanceCents,
      lockedCents: escrow.lockedCents,
      availableCents: escrow.balanceCents - escrow.lockedCents,
      currency: escrow.currency,
    };
  }

  async getLedgerEntries(escrowAccountId: string, limit = 50): Promise<LedgerEntryEntity[]> {
    return this.ledgerRepo.find({
      where: { escrowAccountId },
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['relatedPayment', 'relatedMatch'],
    });
  }

  async findByOrganizer(organizerId: string): Promise<EscrowAccountEntity | null> {
    return this.escrowRepo.findOne({
      where: { ownerUserId: organizerId },
    });
  }
}
