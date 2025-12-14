import { EntityManager, In, Repository } from 'typeorm';
import { MatchEntity, RegistrationEntity, TeamEntity, TournamentEntity } from '../database/entities';
import { ListOptions, PaginatedResult } from './types';
import { NotFoundError, ValidationError } from './errors';
import type { GlobalConfig } from 'types/globalConfig';

export interface CreateMatchInput {
  tournamentId: string;
  code: string;
  mode: MatchEntity['mode'];
  status?: MatchEntity['status'];
  roundNumber?: number;
  reshuffleCount?: number;
  scheduledAt: Date;
  startedAt?: Date | null;
  endedAt?: Date | null;
  roomId?: string | null;
  roomPassword?: string | null;
  participants?: string[];
  resultMetadata?: Record<string, unknown> | null;
}

export interface UpdateMatchInput {
  roundNumber?: number;
  reshuffleCount?: number;
  scheduledAt?: Date;
  roomId?: string | null;
  roomPassword?: string | null;
  resultMetadata?: Record<string, unknown> | null;
}

export interface ScheduleMatchInput {
  code: string;
  mode: MatchEntity['mode'];
  scheduledAt: Date;
  roundNumber?: number;
  participantTeamIds: string[];
}

export class MatchService {
  constructor(
    private readonly matchRepo: Repository<MatchEntity>,
    private readonly tournamentRepo: Repository<TournamentEntity>,
    private readonly registrationRepo: Repository<RegistrationEntity>,
    private readonly teamRepo: Repository<TeamEntity>,
    private readonly config: GlobalConfig,
  ) {}

  async create(input: CreateMatchInput): Promise<MatchEntity> {
    const tournament = await this.ensureTournament(input.tournamentId);
    await this.ensureMatchCodeUnique(input.code);

    const match = this.matchRepo.create({
      tournament,
      code: input.code,
      mode: input.mode,
      status: input.status ?? 'scheduled',
      roundNumber: input.roundNumber ?? 1,
      reshuffleCount: input.reshuffleCount ?? 0,
      scheduledAt: input.scheduledAt,
      startedAt: input.startedAt ?? null,
      endedAt: input.endedAt ?? null,
      roomId: input.roomId ?? null,
      roomPassword: input.roomPassword ?? null,
      participants: [],
      resultMetadata: input.resultMetadata ?? null,
    });

    if (input.participants?.length) {
      match.participants = await this.loadTeams(input.participants);
    }

    return this.matchRepo.save(match);
  }

  async findById(id: string): Promise<MatchEntity> {
    const match = await this.matchRepo.findOne({ where: { id }, relations: ['tournament', 'participants'] });
    if (!match) {
      throw new NotFoundError('Match', id);
    }
    return match;
  }

  async update(id: string, input: UpdateMatchInput): Promise<MatchEntity> {
    const match = await this.findById(id);
    this.matchRepo.merge(match, input);
    return this.matchRepo.save(match);
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
    await this.matchRepo.softDelete(id);
  }

  async list(
    options: ListOptions<{ tournamentId?: string; status?: MatchEntity['status'] }> = {},
  ): Promise<PaginatedResult<MatchEntity>> {
    const { page = 1, limit = 25, filters = {}, sort } = options;
    const where: Record<string, unknown> = {};
    if (filters.tournamentId) where.tournament = { id: filters.tournamentId };
    if (filters.status) where.status = filters.status;

    const [data, total] = await this.matchRepo.findAndCount({
      where,
      relations: ['participants'],
      skip: (page - 1) * limit,
      take: limit,
      order: sort ?? { scheduledAt: 'DESC' },
    });

    return { data, total, page, limit };
  }

  async schedule(tournamentId: string, payload: ScheduleMatchInput): Promise<MatchEntity> {
    return this.matchRepo.manager.transaction(async (manager: EntityManager) => {
      const tournament = await manager.getRepository(TournamentEntity).findOne({ where: { id: tournamentId } });
      if (!tournament) throw new NotFoundError('Tournament', tournamentId);

      await this.ensureMatchCodeUnique(payload.code);

      const participants = await this.validateParticipants(tournamentId, payload.mode, payload.participantTeamIds);

      const match = manager.getRepository(MatchEntity).create({
        tournament,
        code: payload.code,
        mode: payload.mode,
        status: 'scheduled',
        roundNumber: payload.roundNumber ?? 1,
        reshuffleCount: 0,
        scheduledAt: payload.scheduledAt,
        participants,
      });

      return manager.getRepository(MatchEntity).save(match);
    });
  }

  async start(matchId: string): Promise<MatchEntity> {
    const match = await this.findById(matchId);
    if (match.status !== 'scheduled') {
      throw new ValidationError('Only scheduled matches can be started.');
    }
    match.status = 'ongoing';
    match.startedAt = new Date();
    return this.matchRepo.save(match);
  }

  async end(matchId: string, resultMetadata?: Record<string, unknown>): Promise<MatchEntity> {
    const match = await this.findById(matchId);
    if (match.status !== 'ongoing') {
      throw new ValidationError('Only ongoing matches can be ended.');
    }
    match.status = 'ended';
    match.endedAt = new Date();
    match.resultMetadata = resultMetadata ?? match.resultMetadata;
    return this.matchRepo.save(match);
  }

  async assignParticipants(matchId: string, teamIds: string[]): Promise<MatchEntity> {
    return this.matchRepo.manager.transaction(async (manager: EntityManager) => {
      const match = await manager.getRepository(MatchEntity).findOne({ where: { id: matchId }, relations: ['tournament'] });
      if (!match) throw new NotFoundError('Match', matchId);

      const teams = await this.validateParticipants(match.tournament.id, match.mode, teamIds);
      match.participants = teams;
      return manager.getRepository(MatchEntity).save(match);
    });
  }

  async listByTournament(
    tournamentId: string,
    options: ListOptions<{ status?: MatchEntity['status'] }> = {},
  ): Promise<PaginatedResult<MatchEntity>> {
    const filters = { ...(options.filters ?? {}), tournamentId };
    return this.list({ ...options, filters });
  }

  private async ensureTournament(id: string): Promise<TournamentEntity> {
    const tournament = await this.tournamentRepo.findOne({ where: { id } });
    if (!tournament) throw new NotFoundError('Tournament', id);
    return tournament;
  }

  private async ensureMatchCodeUnique(code: string) {
    const existing = await this.matchRepo.findOne({ where: { code } });
    if (existing) {
      throw new ValidationError('Match code already in use.');
    }
  }

  private async validateParticipants(
    tournamentId: string,
    mode: MatchEntity['mode'],
    teamIds: string[],
  ): Promise<TeamEntity[]> {
    if (!teamIds.length) {
      throw new ValidationError('Provide at least one participant team.');
    }

    const requiredCount = mode === 'BR' ? this.config.tournament.br.teamsPerMatch : 2;
    if (teamIds.length !== requiredCount) {
      throw new ValidationError(`Mode ${mode} requires exactly ${requiredCount} teams.`);
    }

    const teams = await this.teamRepo.find({ where: { id: In(teamIds) }, relations: ['members'] });
    if (teams.length !== teamIds.length) {
      throw new ValidationError('One or more team IDs are invalid.');
    }

    const registrations = await this.registrationRepo.find({
      where: {
        tournament: { id: tournamentId },
        team: { id: In(teamIds) },
        status: 'confirmed',
      },
    });

    if (registrations.length !== teamIds.length) {
      throw new ValidationError('All participants must be confirmed in the tournament.');
    }

    return teams;
  }

  private async loadTeams(ids: string[]) {
    return this.teamRepo.find({ where: { id: In(ids) } });
  }
}
