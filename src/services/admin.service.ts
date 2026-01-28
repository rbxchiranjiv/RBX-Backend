import { Repository } from 'typeorm';
import {
  UserEntity,
  UserStatus,
  UserRole,
  TournamentEntity,
  MatchEntity,
  PayoutBatchEntity,
  EscrowAccountEntity,
  WalletEntity,
  RegistrationEntity,
  PaymentRecordEntity,
  PaymentStatus,
} from '../database/entities';
import { AdminAuditLogService } from './admin-audit-log.service';
import { PayoutService, ProcessPayoutResult } from './payout.service';
import { TournamentService } from './tournament.service';
import { MatchLifecycleService, ActorContext } from './match-lifecycle.service';
import { AuthorizationError, NotFoundError, ValidationError } from './errors';

export interface AdminOverview {
  totals: {
    users: number;
    suspendedUsers: number;
  };
  tournaments: {
    open: number;
    live: number;
    cancelled: number;
  };
  matches: {
    scheduled: number;
    live: number;
  };
  payouts: {
    pendingApprovals: number;
    pendingAmountCents: number;
  };
  financials: {
    escrowBalanceCents: number;
    escrowLockedCents: number;
    walletBalance: number;
    walletLockedBalance: number;
  };
}

export interface AnalyticsPoint {
  date: string;
  count?: number;
  amount?: number;
}

export interface MatchOverrideInput {
  winnerTeamId: string;
  reason: string;
  metadata?: Record<string, unknown>;
}

export class AdminService {
  constructor(
    private readonly userRepo: Repository<UserEntity>,
    private readonly tournamentRepo: Repository<TournamentEntity>,
    private readonly matchRepo: Repository<MatchEntity>,
    private readonly payoutBatchRepo: Repository<PayoutBatchEntity>,
    private readonly escrowAccountRepo: Repository<EscrowAccountEntity>,
    private readonly walletRepo: Repository<WalletEntity>,
    private readonly registrationRepo: Repository<RegistrationEntity>,
    private readonly paymentRepo: Repository<PaymentRecordEntity>,
    private readonly payoutService: PayoutService,
    private readonly tournamentService: TournamentService,
    private readonly matchLifecycleService: MatchLifecycleService,
    private readonly adminAuditLogService: AdminAuditLogService,
  ) {}

  async getOverview(): Promise<AdminOverview> {
    const [
      totalUsers,
      suspendedUsers,
      openTournaments,
      liveTournaments,
      cancelledTournaments,
      scheduledMatches,
      liveMatches,
      pendingApprovals,
    ] = await Promise.all([
      this.userRepo.count(),
      this.userRepo.count({ where: { status: UserStatus.SUSPENDED } }),
      this.tournamentRepo.count({ where: { status: 'open' } }),
      this.tournamentRepo.count({ where: { status: 'live' } }),
      this.tournamentRepo.count({ where: { status: 'cancelled' } }),
      this.matchRepo.count({ where: { status: 'scheduled' } }),
      this.matchRepo.count({ where: { status: 'ongoing' } }),
      this.payoutBatchRepo.count({ where: { approvalStatus: 'pending' } }),
    ]);

    const pendingPayoutsAggregate = await this.payoutBatchRepo
      .createQueryBuilder('batch')
      .select('COALESCE(SUM(batch."totalAmountCents"), 0)', 'amount')
      .where('batch."approvalStatus" = :status', { status: 'pending' })
      .getRawOne<{ amount: string }>();

    const escrowTotals = await this.escrowAccountRepo
      .createQueryBuilder('escrow')
      .select('COALESCE(SUM(escrow."balanceCents"), 0)', 'balance')
      .addSelect('COALESCE(SUM(escrow."lockedCents"), 0)', 'locked')
      .getRawOne<{ balance: string; locked: string }>();

    const walletTotals = await this.walletRepo
      .createQueryBuilder('wallet')
      .select('COALESCE(SUM(wallet."balance"), 0)', 'balance')
      .addSelect('COALESCE(SUM(wallet."lockedBalance"), 0)', 'locked')
      .getRawOne<{ balance: string; locked: string }>();

    return {
      totals: {
        users: totalUsers,
        suspendedUsers,
      },
      tournaments: {
        open: openTournaments,
        live: liveTournaments,
        cancelled: cancelledTournaments,
      },
      matches: {
        scheduled: scheduledMatches,
        live: liveMatches,
      },
      payouts: {
        pendingApprovals,
        pendingAmountCents: this.toNumber(pendingPayoutsAggregate?.amount),
      },
      financials: {
        escrowBalanceCents: this.toNumber(escrowTotals?.balance),
        escrowLockedCents: this.toNumber(escrowTotals?.locked),
        walletBalance: this.toNumber(walletTotals?.balance),
        walletLockedBalance: this.toNumber(walletTotals?.locked),
      },
    };
  }

  async approvePayoutBatch(
    actor: ActorContext,
    batchId: string,
    note?: string,
    context?: string | null,
  ): Promise<{ batch: PayoutBatchEntity; processResult: ProcessPayoutResult }> {
    this.ensureAdmin(actor);
    const batch = await this.loadPayoutBatch(batchId);
    if (batch.approvalStatus !== 'pending') {
      throw new ValidationError('Only pending payout batches can be approved.');
    }

    batch.approvalStatus = 'approved';
    batch.approvalNote = note ?? null;
    batch.approvedByUserId = actor.id;
    batch.approvedAt = new Date();
    const saved = await this.payoutBatchRepo.save(batch);

    await this.recordAudit(
      actor,
      'payout.batch.approve',
      'payout_batch',
      saved.id,
      {
        note: note ?? null,
        totalAmountCents: saved.totalAmountCents,
      },
      context,
    );

    const processResult = await this.payoutService.processPayoutBatch(saved.id);

    return { batch: saved, processResult };
  }

  async rejectPayoutBatch(
    actor: ActorContext,
    batchId: string,
    reason: string,
    context?: string | null,
  ): Promise<PayoutBatchEntity> {
    this.ensureAdmin(actor);
    if (!reason?.trim()) {
      throw new ValidationError('Provide a rejection reason.');
    }

    const batch = await this.loadPayoutBatch(batchId);
    if (batch.approvalStatus !== 'pending') {
      throw new ValidationError('Only pending payout batches can be rejected.');
    }

    batch.approvalStatus = 'rejected';
    batch.approvalNote = reason.trim();
    batch.approvedByUserId = actor.id;
    batch.approvedAt = new Date();
    const saved = await this.payoutBatchRepo.save(batch);

    await this.recordAudit(
      actor,
      'payout.batch.reject',
      'payout_batch',
      saved.id,
      {
        reason: saved.approvalNote,
        totalAmountCents: saved.totalAmountCents,
      },
      context,
    );

    return saved;
  }

  async suspendUser(
    actor: ActorContext,
    userId: string,
    reason: string,
    context?: string | null,
  ): Promise<UserEntity> {
    this.ensureAdmin(actor);
    if (!reason?.trim()) {
      throw new ValidationError('Provide a suspension reason.');
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError('User', userId);
    }

    if (user.status === UserStatus.SUSPENDED) {
      return user;
    }

    user.status = UserStatus.SUSPENDED;
    const saved = await this.userRepo.save(user);

    await this.recordAudit(
      actor,
      'user.suspend',
      'user',
      saved.id,
      {
        reason: reason.trim(),
      },
      context,
    );

    return saved;
  }

  async unsuspendUser(
    actor: ActorContext,
    userId: string,
    reason?: string,
    context?: string | null,
  ): Promise<UserEntity> {
    this.ensureAdmin(actor);
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError('User', userId);
    }

    if (user.status === UserStatus.ACTIVE) {
      return user;
    }

    user.status = UserStatus.ACTIVE;
    const saved = await this.userRepo.save(user);

    await this.recordAudit(
      actor,
      'user.unsuspend',
      'user',
      saved.id,
      {
        reason: reason?.trim() ?? null,
      },
      context,
    );

    return saved;
  }

  async cancelTournament(
    actor: ActorContext,
    tournamentId: string,
    reason?: string,
    context?: string | null,
  ): Promise<TournamentEntity> {
    this.ensureAdmin(actor);
    const tournament = await this.tournamentService.cancelTournament(tournamentId, actor);

    await this.recordAudit(
      actor,
      'tournament.cancel',
      'tournament',
      tournament.id,
      {
        reason: reason ?? null,
        status: tournament.status,
      },
      context,
    );

    return tournament;
  }

  async overrideMatchResult(
    actor: ActorContext,
    matchId: string,
    input: MatchOverrideInput,
    context?: string | null,
  ): Promise<MatchEntity> {
    this.ensureAdmin(actor);
    const match = await this.matchLifecycleService.finalizeMatch(matchId, actor, {
      winnerTeamId: input.winnerTeamId,
      adminDecision: {
        reason: input.reason,
        ...(input.metadata ? { metadata: input.metadata } : {}),
      },
    });

    await this.recordAudit(
      actor,
      'match.override_result',
      'match',
      match.id,
      {
        winnerTeamId: input.winnerTeamId,
        reason: input.reason,
        metadata: input.metadata ?? null,
      },
      context,
    );

    return match;
  }

  async getRegistrationsAnalytics(rangeDays = 30): Promise<AnalyticsPoint[]> {
    const rows = await this.registrationRepo
      .createQueryBuilder('registration')
      .select(`DATE_TRUNC('day', registration."createdAt")`, 'date')
      .addSelect('COUNT(*)', 'count')
      .where('registration."createdAt" >= :from', { from: this.getRangeStart(rangeDays) })
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany<{ date: Date; count: string }>();

    return rows.map(row => ({
      date: this.toDateKey(row.date),
      count: this.toNumber(row.count),
    }));
  }

  async getMatchesAnalytics(rangeDays = 30): Promise<AnalyticsPoint[]> {
    const rows = await this.matchRepo
      .createQueryBuilder('match')
      .select(`DATE_TRUNC('day', match."createdAt")`, 'date')
      .addSelect('COUNT(*)', 'count')
      .where('match."createdAt" >= :from', { from: this.getRangeStart(rangeDays) })
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany<{ date: Date; count: string }>();

    return rows.map(row => ({
      date: this.toDateKey(row.date),
      count: this.toNumber(row.count),
    }));
  }

  async getRevenueAnalytics(rangeDays = 30): Promise<AnalyticsPoint[]> {
    const rows = await this.paymentRepo
      .createQueryBuilder('payment')
      .select(`DATE_TRUNC('day', payment."createdAt")`, 'date')
      .addSelect('COALESCE(SUM(payment.amount), 0)', 'amount')
      .where('payment.status = :status', { status: PaymentStatus.SUCCESS })
      .andWhere('payment."createdAt" >= :from', { from: this.getRangeStart(rangeDays) })
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany<{ date: Date; amount: string }>();

    return rows.map(row => ({
      date: this.toDateKey(row.date),
      amount: this.toNumber(row.amount),
    }));
  }

  private async loadPayoutBatch(batchId: string): Promise<PayoutBatchEntity> {
    const batch = await this.payoutBatchRepo.findOne({ where: { id: batchId } });
    if (!batch) {
      throw new NotFoundError('PayoutBatch', batchId);
    }
    return batch;
  }

  private ensureAdmin(actor: ActorContext) {
    if (actor.role !== UserRole.ADMIN) {
      throw new AuthorizationError('Admin privileges required.');
    }
  }

  private toNumber(value?: string | number | null): number {
    if (value === null || value === undefined) {
      return 0;
    }
    if (typeof value === 'number') {
      return value;
    }
    return Number(value) || 0;
  }

  private toDateKey(date: Date | string): string {
    const value = typeof date === 'string' ? new Date(date) : date;
    return value.toISOString().slice(0, 10);
  }

  private getRangeStart(rangeDays: number): Date {
    const days = Number.isFinite(rangeDays) && rangeDays > 0 ? Math.floor(rangeDays) : 30;
    const from = new Date();
    from.setUTCHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (days - 1));
    return from;
  }

  private async recordAudit(
    actor: ActorContext,
    action: string,
    targetType: string,
    targetId: string,
    metadata: Record<string, unknown>,
    context?: string | null,
  ) {
    await this.adminAuditLogService.record({
      action,
      actorId: actor.id,
      actorRole: actor.role,
      targetType,
      targetId,
      metadata,
      context: context ?? null,
    });
  }
}
