import { EntityManager, In, Repository } from 'typeorm';
import type { GlobalConfig } from 'types/globalConfig';
import {
  MatchDisputeEntity,
  MatchEntity,
  MatchProofEntity,
  TeamEntity,
  TournamentEntity,
  UserEntity,
  UserRole,
} from '../database/entities';
import { ConcurrencyLockError, AuthorizationError, DisputeWindowError, NotFoundError, ValidationError } from './errors';
import { NotificationService } from './notification.service';

export type ActorContext = Pick<UserEntity, 'id' | 'role'>;

export interface StartMatchInput {
  roomId?: string;
  roomPassword?: string;
}

export interface EndMatchInput {
  resultPayload: Record<string, unknown>;
  winnerTeamId: string;
  proofUrl?: string;
  reason?: string;
}

export interface FinalizeMatchInput {
  winnerTeamId?: string;
  adminDecision?: Record<string, unknown>;
}

export interface ForfeitMatchInput {
  forfeitingTeamId: string;
  reason: string;
}

export interface RecordProofInput {
  proofUrl: string;
  metadata?: Record<string, unknown>;
  teamId?: string;
}

export interface CreateDisputeInput {
  reason: string;
  evidence?: Record<string, unknown>;
}

export interface ResolveDisputeInput {
  decision: 'upheld' | 'rejected' | 'rerun';
  metadata?: Record<string, unknown>;
}

export class MatchLifecycleService {
  constructor(
    private readonly matchRepo: Repository<MatchEntity>,
    private readonly teamRepo: Repository<TeamEntity>,
    private readonly tournamentRepo: Repository<TournamentEntity>,
    private readonly proofRepo: Repository<MatchProofEntity>,
    private readonly disputeRepo: Repository<MatchDisputeEntity>,
    private readonly userRepo: Repository<UserEntity>,
    private readonly notificationService: NotificationService,
    private readonly config: GlobalConfig,
  ) {}

  async getMatchWithDetails(matchId: string, actor: ActorContext): Promise<MatchEntity> {
    const match = await this.matchRepo.findOne({
      where: { id: matchId },
      relations: ['tournament', 'tournament.organizer', 'participants', 'participants.owner', 'proofs'],
    });
    if (!match) {
      throw new NotFoundError('Match', matchId);
    }
    this.ensureMatchVisibility(match, actor);
    return match;
  }

  async startMatch(matchId: string, actor: ActorContext, input: StartMatchInput = {}): Promise<MatchEntity> {
    return this.withLock(matchId, actor, async (match, manager) => {
      this.assertOrganizerOrAdmin(match, actor);
      if (match.status !== 'scheduled') {
        throw new ValidationError('Only scheduled matches can be started.');
      }
      match.status = 'ongoing';
      match.startedAt = new Date();
      match.roomId = input.roomId ?? match.roomId ?? null;
      match.roomPassword = input.roomPassword ?? match.roomPassword ?? null;
      const saved = await manager.getRepository(MatchEntity).save(match);
      await this.notifyParticipants(match, 'matchStart', {
        matchCode: match.code,
        tournamentName: match.tournament.name,
      });
      return saved;
    });
  }

  async endMatch(matchId: string, actor: ActorContext, input: EndMatchInput): Promise<MatchEntity> {
    return this.withLock(matchId, actor, async (match, manager) => {
      this.assertOrganizerOrAdmin(match, actor);
      if (match.status !== 'ongoing') {
        throw new ValidationError('Only ongoing matches can be ended.');
      }
      const winner = this.findParticipant(match, input.winnerTeamId);
      match.status = 'ended';
      match.endedAt = new Date();
      match.resultMetadata = {
        ...(match.resultMetadata ?? {}),
        resultPayload: input.resultPayload,
        reason: input.reason ?? null,
        updatedAt: new Date().toISOString(),
      };
      match.provisionalWinnerTeam = winner;
      const saved = await manager.getRepository(MatchEntity).save(match);

      if (input.proofUrl) {
        await manager.getRepository(MatchProofEntity).save(
          this.proofRepo.create({
            match,
            uploader: { id: actor.id } as UserEntity,
            team: winner,
            url: input.proofUrl,
            metadata: { source: 'result', ...(input.reason ? { reason: input.reason } : {}) },
          }),
        );
      }

      await this.notifyParticipants(match, 'matchEnd', {
        matchCode: match.code,
        tournamentName: match.tournament.name,
      });
      return saved;
    });
  }

  async finalizeMatch(matchId: string, actor: ActorContext, input: FinalizeMatchInput = {}): Promise<MatchEntity> {
    if (actor.role !== UserRole.ADMIN) {
      throw new AuthorizationError('Only admins can finalize matches.');
    }
    return this.withLock(matchId, actor, async (match, manager) => {
      const winner = input.winnerTeamId
        ? this.findParticipant(match, input.winnerTeamId)
        : match.provisionalWinnerTeam;
      if (!winner) {
        throw new ValidationError('Provide a winner team before finalizing.');
      }
      match.finalWinnerTeam = winner;
      match.status = 'result_confirmed';
      match.resultMetadata = {
        ...(match.resultMetadata ?? {}),
        adminDecision: input.adminDecision ?? null,
        finalizedAt: new Date().toISOString(),
      };
      const saved = await manager.getRepository(MatchEntity).save(match);
      await this.updateTournamentProgression(manager, match, winner);
      await this.notifyParticipants(match, 'resultPublished', {
        matchCode: match.code,
        tournamentName: match.tournament.name,
        winnerTeam: winner.name,
      });
      return saved;
    });
  }

  async forfeitMatch(matchId: string, actor: ActorContext, input: ForfeitMatchInput): Promise<MatchEntity> {
    return this.withLock(matchId, actor, async (match, manager) => {
      this.assertOrganizerOrAdmin(match, actor);
      const forfeitingTeam = this.findParticipant(match, input.forfeitingTeamId);
      const opponent = match.participants.find(team => team.id !== forfeitingTeam.id);
      if (!opponent) {
        throw new ValidationError('Unable to determine opponent for forfeit.');
      }
      match.status = 'ended';
      match.endedAt = new Date();
      match.forfeited = true;
      match.forfeitedByTeam = forfeitingTeam;
      match.provisionalWinnerTeam = opponent;
      match.resultMetadata = {
        ...(match.resultMetadata ?? {}),
        forfeitReason: input.reason,
      };
      const saved = await manager.getRepository(MatchEntity).save(match);
      await this.notifyParticipants(match, 'matchEnd', {
        matchCode: match.code,
        tournamentName: match.tournament.name,
        forfeitedTeam: forfeitingTeam.name,
      });
      return saved;
    });
  }

  async revertMatch(matchId: string, actor: ActorContext, reason?: string): Promise<MatchEntity> {
    if (actor.role !== UserRole.ADMIN) {
      throw new AuthorizationError('Only admins can revert matches.');
    }
    return this.withLock(matchId, actor, async (match, manager) => {
      match.status = 'scheduled';
      match.startedAt = null;
      match.endedAt = null;
      match.provisionalWinnerTeam = null;
      match.finalWinnerTeam = null;
      match.resultMetadata = {
        ...(match.resultMetadata ?? {}),
        revertedAt: new Date().toISOString(),
        revertReason: reason ?? null,
      };
      match.forfeited = false;
      match.forfeitedByTeam = null;
      await manager.getRepository(MatchEntity).save(match);
      return match;
    });
  }

  async recordProof(matchId: string, actor: ActorContext, input: RecordProofInput): Promise<MatchProofEntity> {
    const match = await this.matchRepo.findOne({ where: { id: matchId } });
    if (!match) {
      throw new NotFoundError('Match', matchId);
    }
    const proof = this.proofRepo.create({
      match,
      uploader: { id: actor.id } as UserEntity,
      team: input.teamId ? ({ id: input.teamId } as TeamEntity) : null,
      url: input.proofUrl,
      metadata: input.metadata ?? null,
    });
    return this.proofRepo.save(proof);
  }

  async createDispute(matchId: string, actor: ActorContext, input: CreateDisputeInput): Promise<MatchDisputeEntity> {
    const match = await this.matchRepo.findOne({
      where: { id: matchId },
      relations: ['participants', 'participants.owner', 'tournament', 'tournament.organizer'],
    });
    if (!match) {
      throw new NotFoundError('Match', matchId);
    }
    if (!match.endedAt) {
      throw new ValidationError('Match has not ended yet.');
    }
    const disputeWindowMs = (this.config.match.disputeWindowMinutes ?? 30) * 60 * 1000;
    if (Date.now() - match.endedAt.getTime() > disputeWindowMs) {
      throw new DisputeWindowError();
    }
    const team = match.participants.find(part => part.owner?.id === actor.id);
    if (!team) {
      throw new AuthorizationError('Only participant team owners may file disputes.');
    }
    match.status = 'disputed';
    await this.matchRepo.save(match);

    const dispute = this.disputeRepo.create({
      match,
      complainantTeam: { id: team.id } as TeamEntity,
      complainantUser: { id: actor.id } as UserEntity,
      status: 'open',
      reason: input.reason,
      evidence: input.evidence ?? null,
    });
    const saved = await this.disputeRepo.save(dispute);
    await this.notifyTournamentOrganizer(match, 'disputeUpdate', {
      disputeId: saved.id,
      status: 'open',
    });
    return saved;
  }

  async listDisputes(status?: MatchDisputeEntity['status']): Promise<MatchDisputeEntity[]> {
    try {
      // Use a simple query without relations to avoid pg-mem issues
      const qb = this.disputeRepo.createQueryBuilder('dispute');
      if (status) {
        qb.andWhere('dispute.status = :status', { status });
      }
      const disputes = await qb.getMany();
      
      // Manually attach minimal relation data for the response
      return disputes.map(dispute => ({
        ...dispute,
        match: { id: (dispute as any).matchId },
        complainantTeam: (dispute as any).complainantTeamId ? { id: (dispute as any).complainantTeamId } : null,
        complainantUser: { id: (dispute as any).complainantUserId },
      })) as any;
    } catch (error) {
      console.error('listDisputes error:', error);
      throw error;
    }
  }

  async resolveDispute(disputeId: string, actor: ActorContext, input: ResolveDisputeInput): Promise<MatchDisputeEntity> {
    if (actor.role !== UserRole.ADMIN) {
      throw new AuthorizationError('Only admins can resolve disputes.');
    }
    const dispute = await this.disputeRepo.findOne({
      where: { id: disputeId },
      relations: ['match', 'match.tournament', 'match.participants', 'match.provisionalWinnerTeam', 'match.finalWinnerTeam'],
    });
    if (!dispute) {
      throw new NotFoundError('Dispute', disputeId);
    }
    dispute.status = 'resolved';
    dispute.resolution = { decision: input.decision, metadata: input.metadata ?? null };
    dispute.resolvedAt = new Date();
    dispute.resolvedBy = { id: actor.id } as UserEntity;

    await this.matchRepo.manager.transaction(async manager => {
      const match = await manager.getRepository(MatchEntity).findOne({
        where: { id: dispute.match.id },
        relations: ['participants', 'participants.owner', 'tournament', 'tournament.organizer'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!match) {
        throw new NotFoundError('Match', dispute.match.id);
      }
      if (input.decision === 'upheld') {
        match.status = 'result_confirmed';
        match.finalWinnerTeam = match.provisionalWinnerTeam ?? match.finalWinnerTeam ?? null;
        await manager.getRepository(MatchEntity).save(match);
        if (match.finalWinnerTeam) {
          await this.updateTournamentProgression(manager, match, match.finalWinnerTeam);
        }
      } else if (input.decision === 'rejected') {
        match.status = 'ended';
        await manager.getRepository(MatchEntity).save(match);
      } else if (input.decision === 'rerun') {
        match.status = 'scheduled';
        match.startedAt = null;
        match.endedAt = null;
        match.provisionalWinnerTeam = null;
        match.finalWinnerTeam = null;
        await manager.getRepository(MatchEntity).save(match);
      }
      await manager.getRepository(MatchDisputeEntity).save(dispute);
      await this.notifyParticipants(match, 'disputeUpdate', {
        disputeId: dispute.id,
        status: dispute.status,
      });
    });

    return dispute;
  }

  private async withLock<T>(matchId: string, actor: ActorContext, handler: (match: MatchEntity, manager: EntityManager) => Promise<T>): Promise<T> {
    try {
      return await this.matchRepo.manager.transaction(async manager => {
        const repo = manager.getRepository(MatchEntity);
        const relations = [
          'tournament',
          'tournament.organizer',
          'participants',
          'participants.owner',
          'provisionalWinnerTeam',
          'finalWinnerTeam',
          'forfeitedByTeam',
          'disputes',
        ];
        const options: Parameters<typeof repo.findOne>[0] = {
          where: { id: matchId },
          relations,
        };
        if (this.config.match.concurrencyLockStrategy === 'db') {
          options.lock = { mode: 'pessimistic_write' } as const;
        }
        const match = await repo.findOne(options);
        if (!match) {
          throw new NotFoundError('Match', matchId);
        }
        return handler(match, manager);
      });
    } catch (error) {
      if (error instanceof ConcurrencyLockError) {
        throw error;
      }
      if (/(deadlock detected|could not obtain)/i.test(String(error))) {
        throw new ConcurrencyLockError();
      }
      throw error;
    }
  }

  private assertOrganizerOrAdmin(match: MatchEntity, actor: ActorContext) {
    if (actor.role === UserRole.ADMIN) {
      return;
    }
    if (match.tournament.organizer.id !== actor.id) {
      throw new AuthorizationError('Only the organizer or an admin can manage matches.');
    }
  }

  private ensureMatchVisibility(match: MatchEntity, actor: ActorContext) {
    if (actor.role === UserRole.ADMIN) {
      return;
    }
    if (match.tournament.organizer.id === actor.id) {
      return;
    }
    const ownsTeam = match.participants.some(team => team.owner?.id === actor.id);
    if (!ownsTeam) {
      throw new AuthorizationError('You are not allowed to view this match.');
    }
  }

  private findParticipant(match: MatchEntity, teamId: string): TeamEntity {
    const team = match.participants.find(participant => participant.id === teamId);
    if (!team) {
      throw new ValidationError('Winner team must be a participant.');
    }
    return team;
  }

  private async notifyParticipants(match: MatchEntity, templateKey: string, basePayload: Record<string, unknown>) {
    await Promise.all(
      match.participants.map(team =>
        this.notificationService.queue(team.owner.id, templateKey, 'inApp', {
          ...basePayload,
          teamName: team.name,
        }, {
          tournamentId: match.tournament.id,
          matchId: match.id,
        }),
      ),
    );
  }

  private async notifyTournamentOrganizer(match: MatchEntity, templateKey: string, payload: Record<string, unknown>) {
    await this.notificationService.queue(match.tournament.organizer.id, templateKey, 'inApp', payload, {
      tournamentId: match.tournament.id,
      matchId: match.id,
    });
  }

  private async updateTournamentProgression(manager: EntityManager, match: MatchEntity, winner: TeamEntity) {
    const tournament = await manager.getRepository(TournamentEntity).findOne({ where: { id: match.tournament.id } });
    if (!tournament) {
      return;
    }
    const metadata = { ...(tournament.metadata ?? {}) } as Record<string, unknown>;
    const roundKey = `round_${match.roundNumber ?? 1}`;
    const matchResults = (metadata.matchResults as Record<string, string[]>) ?? {};
    const roundResults = new Set(matchResults[roundKey] ?? []);
    roundResults.add(winner.id);
    matchResults[roundKey] = Array.from(roundResults);
    metadata.matchResults = matchResults;
    metadata.lastResult = {
      matchId: match.id,
      winnerTeamId: winner.id,
      winnerTeamName: winner.name,
      recordedAt: new Date().toISOString(),
    };
    tournament.metadata = metadata;
    await manager.getRepository(TournamentEntity).save(tournament);
  }
}
