import { EntityManager, Repository } from 'typeorm';
import { PaymentRecordEntity, RegistrationEntity, TournamentEntity, UserEntity } from '../database/entities';
import { ListOptions, PaginatedResult } from './types';
import { NotFoundError, ValidationError } from './errors';

export interface CreatePaymentRecordInput {
  userId: string;
  direction: PaymentRecordEntity['direction'];
  amount: number;
  currency?: string;
  gateway: string;
  referenceId: string;
  status?: PaymentRecordEntity['status'];
  metadata?: Record<string, unknown> | null;
  tournamentId?: string;
  registrationId?: string;
  escrowHold?: boolean;
}

export interface UpdatePaymentRecordInput {
  status?: PaymentRecordEntity['status'];
  metadata?: Record<string, unknown> | null;
  escrowHold?: boolean;
}

export interface RecordLedgerInput {
  amount: number;
  currency?: string;
  gateway: string;
  referenceId: string;
  metadata?: Record<string, unknown> | null;
  tournamentId?: string;
  registrationId?: string;
  escrowHold?: boolean;
}

export class PaymentRecordService {
  constructor(
    private readonly paymentRepo: Repository<PaymentRecordEntity>,
    private readonly userRepo: Repository<UserEntity>,
    private readonly tournamentRepo: Repository<TournamentEntity>,
    private readonly registrationRepo: Repository<RegistrationEntity>,
  ) {}

  async create(input: CreatePaymentRecordInput): Promise<PaymentRecordEntity> {
    await this.ensureUser(input.userId);
    await this.ensureUniqueReference(input.referenceId);
    const tournament = input.tournamentId ? await this.ensureTournament(input.tournamentId) : null;
    const registration = input.registrationId ? await this.ensureRegistration(input.registrationId) : null;

    const record = this.paymentRepo.create({
      user: { id: input.userId } as UserEntity,
      direction: input.direction,
      amount: input.amount,
      currency: input.currency ?? 'INR',
      gateway: input.gateway,
      referenceId: input.referenceId,
      status: input.status ?? 'pending',
      metadata: input.metadata ?? null,
      escrowHold: input.escrowHold ?? false,
      tournament: tournament ?? null,
      registration: registration ?? null,
    });

    return this.paymentRepo.save(record);
  }

  async findById(id: string): Promise<PaymentRecordEntity> {
    const record = await this.paymentRepo.findOne({ where: { id }, relations: ['user'] });
    if (!record) {
      throw new NotFoundError('PaymentRecord', id);
    }
    return record;
  }

  async update(id: string, input: UpdatePaymentRecordInput): Promise<PaymentRecordEntity> {
    const record = await this.findById(id);
    this.paymentRepo.merge(record, input);
    return this.paymentRepo.save(record);
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
    await this.paymentRepo.softDelete(id);
  }

  async list(
    options: ListOptions<{ userId?: string; status?: PaymentRecordEntity['status'] }> = {},
  ): Promise<PaginatedResult<PaymentRecordEntity>> {
    const { page = 1, limit = 25, filters = {}, sort } = options;
    const where: Record<string, unknown> = {};
    if (filters.userId) where.user = { id: filters.userId };
    if (filters.status) where.status = filters.status;

    const [data, total] = await this.paymentRepo.findAndCount({
      where,
      relations: ['user'],
      skip: (page - 1) * limit,
      take: limit,
      order: sort ?? { createdAt: 'DESC' },
    });

    return { data, total, page, limit };
  }

  async recordCredit(userId: string, input: RecordLedgerInput): Promise<PaymentRecordEntity> {
    return this.create({ ...input, userId, direction: 'credit' });
  }

  async recordDebit(userId: string, input: RecordLedgerInput): Promise<PaymentRecordEntity> {
    return this.create({ ...input, userId, direction: 'debit' });
  }

  async updateStatus(referenceId: string, status: PaymentRecordEntity['status'], processedAt?: Date): Promise<PaymentRecordEntity> {
    const record = await this.paymentRepo.findOne({ where: { referenceId } });
    if (!record) {
      throw new NotFoundError('PaymentRecord', referenceId);
    }
    record.status = status;
    record.processedAt = processedAt ?? new Date();
    return this.paymentRepo.save(record);
  }

  async listByUser(
    userId: string,
    options: ListOptions<{ status?: PaymentRecordEntity['status'] }> = {},
  ): Promise<PaginatedResult<PaymentRecordEntity>> {
    const filters = { ...(options.filters ?? {}), userId };
    return this.list({ ...options, filters });
  }

  private async ensureUser(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundError('User', id);
  }

  private async ensureTournament(id: string) {
    const tournament = await this.tournamentRepo.findOne({ where: { id } });
    if (!tournament) throw new NotFoundError('Tournament', id);
    return tournament;
  }

  private async ensureRegistration(id: string) {
    const registration = await this.registrationRepo.findOne({ where: { id } });
    if (!registration) throw new NotFoundError('Registration', id);
    return registration;
  }

  private async ensureUniqueReference(referenceId: string) {
    const existing = await this.paymentRepo.findOne({ where: { referenceId } });
    if (existing) {
      throw new ValidationError('Reference ID already exists.');
    }
  }
}
