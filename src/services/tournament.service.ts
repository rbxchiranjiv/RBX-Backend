import { DeepPartial, In, Repository } from 'typeorm';
import { RegistrationEntity, TeamEntity, TournamentEntity, UserEntity } from '../database/entities';
import { ListOptions, PaginatedResult } from './types';
import { NotFoundError, ValidationError } from './errors';
import type { GlobalConfig } from 'types/globalConfig';

export interface CreateTournamentInput {
  name: string;
  slug: string;
  mode: TournamentEntity['mode'];
  organizerId: string;
  entryFee?: number;
  creationFee?: number;
  prizePool?: number;
  maxTeams?: number;
  registrationOpensAt?: Date | null;
  registrationClosesAt?: Date | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  invitesEnabled?: boolean;
  isVersus?: boolean;
  metadata?: Record<string, unknown> | null;
}

export type UpdateTournamentInput = DeepPartial<CreateTournamentInput> & {
  status?: TournamentEntity['status'];
};

export class TournamentService {
  constructor(
    private readonly tournamentRepo: Repository<TournamentEntity>,
    private readonly teamRepo: Repository<TeamEntity>,
    private readonly registrationRepo: Repository<RegistrationEntity>,
    private readonly userRepo: Repository<UserEntity>,
    private readonly config: GlobalConfig,
  ) {}

  async create(input: CreateTournamentInput): Promise<TournamentEntity> {
    this.assertRequired(
      Boolean(input.name && input.slug && input.mode && input.organizerId),
      'Missing required tournament fields.',
    );

    await this.ensureSlugUnique(input.slug);
    await this.ensureOrganizer(input.organizerId);

    const tournament = this.tournamentRepo.create({
      name: input.name,
      slug: input.slug,
      mode: input.mode,
      status: 'draft',
      entryFee: input.entryFee ?? 0,
      creationFee: input.creationFee ?? 0,
      prizePool: input.prizePool ?? 0,
      maxTeams: input.maxTeams ?? this.config.limits.maxTeamsPerTournament,
      registrationOpensAt: input.registrationOpensAt ?? null,
      registrationClosesAt: input.registrationClosesAt ?? null,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      invitesEnabled: input.invitesEnabled ?? false,
      isVersus: input.isVersus ?? false,
      metadata: input.metadata ?? null,
      organizer: { id: input.organizerId } as TournamentEntity['organizer'],
    });

    return this.tournamentRepo.save(tournament);
  }

  async findById(id: string): Promise<TournamentEntity> {
    const tournament = await this.tournamentRepo.findOne({ where: { id }, relations: ['organizer'] });
    if (!tournament) {
      throw new NotFoundError('Tournament', id);
    }
    return tournament;
  }

  async update(id: string, input: UpdateTournamentInput): Promise<TournamentEntity> {
    const tournament = await this.findById(id);

    if (input.slug && input.slug !== tournament.slug) {
      await this.ensureSlugUnique(input.slug, id);
    }

    if (input.organizerId && input.organizerId !== tournament.organizer.id) {
      await this.ensureOrganizer(input.organizerId);
      tournament.organizer = { id: input.organizerId } as TournamentEntity['organizer'];
    }

    this.tournamentRepo.merge(tournament, input);
    return this.tournamentRepo.save(tournament);
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
    await this.tournamentRepo.softDelete(id);
  }

  async list(
    options: ListOptions<{ mode?: TournamentEntity['mode']; status?: TournamentEntity['status'] }> = {},
  ): Promise<PaginatedResult<TournamentEntity>> {
    const { page = 1, limit = 25, filters = {} } = options;
    const where: Record<string, unknown> = {};
    if (filters.mode) where.mode = filters.mode;
    if (filters.status) where.status = filters.status;

    const [data, total] = await this.tournamentRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { data, total, page, limit };
  }

  async inviteTeam(tournamentId: string, teamId: string): Promise<void> {
    this.ensureInvitesAllowed();
    const tournament = await this.tournamentRepo.findOne({ where: { id: tournamentId }, relations: ['invitedTeams'] });
    if (!tournament) throw new NotFoundError('Tournament', tournamentId);
    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team) throw new NotFoundError('Team', teamId);

    if (tournament.invitedTeams.some((t: TeamEntity) => t.id === team.id)) {
      throw new ValidationError('Team already invited.');
    }

    const { maxInvitedTeamsPerTournament } = this.config.tournament.invitedSlots;
    if (tournament.invitedTeams.length >= maxInvitedTeamsPerTournament) {
      throw new ValidationError('Invite limit reached for this tournament.');
    }

    tournament.invitedTeams.push(team);
    await this.tournamentRepo.save(tournament);
  }

  async removeInvite(tournamentId: string, teamId: string): Promise<void> {
    const tournament = await this.tournamentRepo.findOne({ where: { id: tournamentId }, relations: ['invitedTeams'] });
    if (!tournament) throw new NotFoundError('Tournament', tournamentId);

    const before = tournament.invitedTeams.length;
    tournament.invitedTeams = tournament.invitedTeams.filter((team: TeamEntity) => team.id !== teamId);
    if (before === tournament.invitedTeams.length) {
      throw new ValidationError('Team was not invited.');
    }
    await this.tournamentRepo.save(tournament);
  }

  async listInvitedTeams(tournamentId: string): Promise<TeamEntity[]> {
    const tournament = await this.tournamentRepo.findOne({ where: { id: tournamentId }, relations: ['invitedTeams'] });
    if (!tournament) throw new NotFoundError('Tournament', tournamentId);
    return tournament.invitedTeams;
  }

  async listRegistrations(
    tournamentId: string,
    options: ListOptions<{ status?: RegistrationEntity['status'] }> = {},
  ): Promise<PaginatedResult<RegistrationEntity>> {
    const { page = 1, limit = 25, filters = {} } = options;
    const where: Record<string, unknown> = { tournament: { id: tournamentId } };
    if (filters.status) where.status = filters.status;

    const [data, total] = await this.registrationRepo.findAndCount({
      where,
      relations: ['team'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { data, total, page, limit };
  }

  async publish(tournamentId: string): Promise<TournamentEntity> {
    const tournament = await this.findById(tournamentId);
    if (tournament.status !== 'draft') {
      throw new ValidationError('Only draft tournaments can be published.');
    }

    if (tournament.entryFee < 0) {
      throw new ValidationError('Entry fee cannot be negative.');
    }

    if (tournament.maxTeams > this.config.limits.maxTeamsPerTournament) {
      throw new ValidationError('maxTeams exceeds platform limit.');
    }

    this.assertCreationFeeTier(tournament);

    tournament.status = 'published';
    return this.tournamentRepo.save(tournament);
  }

  private async ensureSlugUnique(slug: string, excludeId?: string) {
    const existing = await this.tournamentRepo.findOne({ where: { slug } });
    if (existing && existing.id !== excludeId) {
      throw new ValidationError('Tournament slug already in use.');
    }
  }

  private assertRequired(condition: boolean, message: string) {
    if (!condition) {
      throw new ValidationError(message);
    }
  }

  private ensureInvitesAllowed() {
    if (!this.config.tournament.invitedSlots.allowOrganizerInvites) {
      throw new ValidationError('Invites are disabled platform-wide.');
    }
  }

  private assertCreationFeeTier(tournament: TournamentEntity) {
    const { creationFees } = this.config.organizer;
    const expected =
      tournament.maxTeams <= 100
        ? creationFees.small
        : tournament.maxTeams <= 500
        ? creationFees.medium
        : creationFees.large;

    if (tournament.creationFee !== expected) {
      throw new ValidationError('Creation fee does not match expected tier.', {
        expected,
        received: tournament.creationFee,
      });
    }
  }

  private async ensureOrganizer(organizerId: string) {
    const organizer = await this.userRepo.findOne({ where: { id: organizerId } });
    if (!organizer) {
      throw new NotFoundError('User', organizerId);
    }
  }
}
