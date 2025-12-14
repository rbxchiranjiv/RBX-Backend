import { EntityManager, In, Not, Repository } from 'typeorm';
import {
  PaymentRecordEntity,
  RegistrationEntity,
  TeamEntity,
  TournamentEntity,
} from '../database/entities';
import { ListOptions, PaginatedResult } from './types';
import { NotFoundError, ValidationError } from './errors';
import type { GlobalConfig } from 'types/globalConfig';

export interface CreateRegistrationInput {
  tournamentId: string;
  teamId: string;
  invitedSlot?: boolean;
  paymentRecordId?: string;
  metadata?: Record<string, unknown> | null;
}

export interface UpdateRegistrationInput {
  invitedSlot?: boolean;
  metadata?: Record<string, unknown> | null;
}

export class RegistrationService {
  constructor(
    private readonly registrationRepo: Repository<RegistrationEntity>,
    private readonly tournamentRepo: Repository<TournamentEntity>,
    private readonly teamRepo: Repository<TeamEntity>,
    private readonly paymentRepo: Repository<PaymentRecordEntity>,
    private readonly config: GlobalConfig,
  ) {}

  async create(input: CreateRegistrationInput): Promise<RegistrationEntity> {
    const tournament = await this.ensureTournament(input.tournamentId);
    const team = await this.ensureTeam(input.teamId);

    this.assertRegistrationWindow(tournament);
    await this.ensureUniqueRegistration(tournament.id, team.id);
    await this.assertRegistrationCapacity(tournament.id, tournament.maxTeams);

    if (input.invitedSlot) {
      this.assertInvitedSlotEligibility(tournament, team.id);
      await this.assertInvitedSlotCapacity(tournament.id);
    }

    const requiresPayment = tournament.entryFee > 0 && !input.invitedSlot;
    if (requiresPayment && !input.paymentRecordId) {
      throw new ValidationError('Payment is required to register for this tournament.');
    }

    const registration = await this.registrationRepo.save(
      this.registrationRepo.create({
        tournament,
        team,
        status: 'pending',
        paymentStatus: 'pending',
        invitedSlot: input.invitedSlot ?? false,
        amountPaid: 0,
        metadata: input.metadata ?? null,
      }),
    );

    if (input.paymentRecordId) {
      return this.linkPaymentRecord(registration, input.paymentRecordId, team.owner.id, tournament.id);
    }

    return registration;
  }

  async findById(id: string): Promise<RegistrationEntity> {
    const registration = await this.registrationRepo.findOne({
      where: { id },
      relations: ['tournament', 'team', 'paymentRecords'],
    });
    if (!registration) {
      throw new NotFoundError('Registration', id);
    }
    return registration;
  }

  async update(id: string, input: UpdateRegistrationInput): Promise<RegistrationEntity> {
    const registration = await this.findById(id);
    this.registrationRepo.merge(registration, input);
    return this.registrationRepo.save(registration);
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
    await this.registrationRepo.softDelete(id);
  }

  async list(
    options: ListOptions<{ tournamentId?: string; teamId?: string; status?: RegistrationEntity['status'] }> = {},
  ): Promise<PaginatedResult<RegistrationEntity>> {
    const { page = 1, limit = 25, filters = {}, sort } = options;
    const where: Record<string, unknown> = {};

    if (filters.tournamentId) {
      where.tournament = { id: filters.tournamentId };
    }
    if (filters.teamId) {
      where.team = { id: filters.teamId };
    }
    if (filters.status) {
      where.status = filters.status;
    }

    const [data, total] = await this.registrationRepo.findAndCount({
      where,
      relations: ['team'],
      skip: (page - 1) * limit,
      take: limit,
      order: sort ?? { createdAt: 'DESC' },
    });

    return { data, total, page, limit };
  }

  async confirm(registrationId: string): Promise<RegistrationEntity> {
    return this.registrationRepo.manager.transaction(async (manager: EntityManager) => {
      const regRepo = manager.getRepository(RegistrationEntity);
      const tournamentRepo = manager.getRepository(TournamentEntity);

      const registration = await regRepo.findOne({
        where: { id: registrationId },
        relations: ['tournament'],
      });
      if (!registration) {
        throw new NotFoundError('Registration', registrationId);
      }

      if (registration.status === 'cancelled') {
        throw new ValidationError('Cannot confirm a cancelled registration.');
      }

      if (registration.status === 'confirmed') {
        return registration;
      }

      const tournament = await tournamentRepo.findOne({ where: { id: registration.tournament.id } });
      if (!tournament) {
        throw new NotFoundError('Tournament', registration.tournament.id);
      }

      const confirmedCount = await regRepo.count({
        where: { tournament: { id: tournament.id }, status: 'confirmed' },
      });

      if (confirmedCount >= tournament.maxTeams) {
        throw new ValidationError('Tournament capacity reached.');
      }

      registration.status = 'confirmed';
      return regRepo.save(registration);
    });
  }

  async cancel(registrationId: string, options: { allowAfterStart?: boolean } = {}): Promise<RegistrationEntity> {
    const registration = await this.findById(registrationId);
    if (registration.status === 'cancelled') {
      throw new ValidationError('Registration already cancelled.');
    }

    const startsAt = registration.tournament.startsAt;
    if (!options.allowAfterStart && startsAt && startsAt.getTime() <= Date.now()) {
      throw new ValidationError('Cannot cancel registrations after the tournament has started.');
    }

    registration.status = 'cancelled';
    if (registration.paymentStatus === 'paid') {
      registration.paymentStatus = 'refunded';
      const payments = await this.paymentRepo.find({ where: { registration: { id: registration.id } } });
      await Promise.all(
        payments.map(payment => {
          payment.status = 'refunded';
          return this.paymentRepo.save(payment);
        }),
      );
    }
    return this.registrationRepo.save(registration);
  }

  async markPaid(registrationId: string, paymentRecordId: string): Promise<RegistrationEntity> {
    return this.registrationRepo.manager.transaction(async (manager: EntityManager) => {
      const regRepo = manager.getRepository(RegistrationEntity);
      const payRepo = manager.getRepository(PaymentRecordEntity);

      const registration = await regRepo.findOne({ where: { id: registrationId } });
      if (!registration) {
        throw new NotFoundError('Registration', registrationId);
      }

      const payment = await payRepo.findOne({ where: { id: paymentRecordId } });
      if (!payment) {
        throw new NotFoundError('PaymentRecord', paymentRecordId);
      }

      payment.registration = registration;
      registration.paymentStatus = 'paid';
      registration.amountPaid = payment.amount;

      await payRepo.save(payment);
      return regRepo.save(registration);
    });
  }

  async assignTeam(registrationId: string, teamId: string): Promise<RegistrationEntity> {
    return this.registrationRepo.manager.transaction(async (manager: EntityManager) => {
      const regRepo = manager.getRepository(RegistrationEntity);
      const teamRepo = manager.getRepository(TeamEntity);

      const registration = await regRepo.findOne({ where: { id: registrationId }, relations: ['tournament', 'team'] });
      if (!registration) {
        throw new NotFoundError('Registration', registrationId);
      }

      const newTeam = await teamRepo.findOne({ where: { id: teamId } });
      if (!newTeam) {
        throw new NotFoundError('Team', teamId);
      }

      const existing = await regRepo.findOne({
        where: {
          tournament: { id: registration.tournament.id },
          team: { id: newTeam.id },
        },
      });

      if (existing && existing.id !== registration.id) {
        throw new ValidationError('Team already registered for this tournament.');
      }

      registration.team = newTeam;
      return regRepo.save(registration);
    });
  }

  async listByTournament(
    tournamentId: string,
    options: ListOptions<{ status?: RegistrationEntity['status'] }> = {},
  ): Promise<PaginatedResult<RegistrationEntity>> {
    const filters = { ...(options.filters ?? {}), tournamentId };
    return this.list({ ...options, filters });
  }

  private async ensureTournament(id: string): Promise<TournamentEntity> {
    const tournament = await this.tournamentRepo.findOne({ where: { id }, relations: ['invitedTeams'] });
    if (!tournament) {
      throw new NotFoundError('Tournament', id);
    }
    return tournament;
  }

  private async ensureTeam(id: string): Promise<TeamEntity> {
    const team = await this.teamRepo.findOne({ where: { id }, relations: ['members', 'owner'] });
    if (!team) {
      throw new NotFoundError('Team', id);
    }

    const min = this.config.limits.minPlayersPerTeam;
    if (team.members.length < min) {
      throw new ValidationError(`Teams must have at least ${min} members before registering.`);
    }
    return team;
  }

  private async ensureUniqueRegistration(tournamentId: string, teamId: string) {
    const existing = await this.registrationRepo.findOne({
      where: {
        tournament: { id: tournamentId },
        team: { id: teamId },
      },
    });

    if (existing) {
      throw new ValidationError('Team already registered for this tournament.');
    }
  }

  private assertRegistrationWindow(tournament: TournamentEntity) {
    if (tournament.status !== 'published') {
      throw new ValidationError('Tournament is not open for registrations.');
    }

    const now = Date.now();
    if (tournament.registrationOpensAt && now < tournament.registrationOpensAt.getTime()) {
      throw new ValidationError('Registrations have not opened yet.');
    }
    if (tournament.registrationClosesAt && now > tournament.registrationClosesAt.getTime()) {
      throw new ValidationError('Registrations have closed for this tournament.');
    }
  }

  private async assertRegistrationCapacity(tournamentId: string, limit: number) {
    const activeStatuses: RegistrationEntity['status'][] = ['pending', 'confirmed', 'waitlisted'];
    const count = await this.registrationRepo.count({
      where: {
        tournament: { id: tournamentId },
        status: In(activeStatuses),
      },
    });

    if (count >= limit) {
      throw new ValidationError('Tournament registration slots are full.');
    }
  }

  private assertInvitedSlotEligibility(tournament: TournamentEntity, teamId: string) {
    if (!tournament.invitesEnabled) {
      throw new ValidationError('Invited slots are not enabled for this tournament.');
    }
    const invitedTeamIds = tournament.invitedTeams?.map(team => team.id) ?? [];
    if (!invitedTeamIds.includes(teamId)) {
      throw new ValidationError('Team has not been invited to this tournament.');
    }
  }

  private async assertInvitedSlotCapacity(tournamentId: string) {
    const limit = this.config.organizer.invitedSlotLimit ?? this.config.tournament.invitedSlots.maxInvitedTeamsPerTournament;
    if (!limit) {
      return;
    }

    const count = await this.registrationRepo.count({
      where: {
        tournament: { id: tournamentId },
        invitedSlot: true,
        status: Not('cancelled'),
      },
    });

    if (count >= limit) {
      throw new ValidationError('Invited slot limit reached for this tournament.');
    }
  }

  private async linkPaymentRecord(
    registration: RegistrationEntity,
    paymentRecordId: string,
    teamOwnerId: string,
    tournamentId: string,
  ): Promise<RegistrationEntity> {
    return this.registrationRepo.manager.transaction(async (manager: EntityManager) => {
      const regRepo = manager.getRepository(RegistrationEntity);
      const payRepo = manager.getRepository(PaymentRecordEntity);

      const payment = await payRepo.findOne({
        where: { id: paymentRecordId },
        relations: ['user', 'registration', 'tournament'],
      });
      if (!payment) {
        throw new NotFoundError('PaymentRecord', paymentRecordId);
      }
      if (payment.registration && payment.registration.id !== registration.id) {
        throw new ValidationError('Payment record already linked to another registration.');
      }
      if (payment.user.id !== teamOwnerId) {
        throw new ValidationError('Payment record must belong to the team owner.');
      }
      if (payment.tournament && payment.tournament.id !== tournamentId) {
        throw new ValidationError('Payment record is for a different tournament.');
      }

      payment.registration = registration;
      payment.tournament = payment.tournament ?? { id: tournamentId } as TournamentEntity;
      registration.paymentStatus = 'paid';
      registration.amountPaid = payment.amount;

      await payRepo.save(payment);
      return regRepo.save(registration);
    });
  }
}
