import { Router } from 'express';
import { ServiceContainer } from '../services/service-factory';
import { asyncHandler, sendSuccess } from './http-utils';
import { validateDto } from './dto/utils';
import { CreateTournamentDto, InviteTeamDto, UpdateTournamentDto } from './dto/tournament.dto';
import { getPaginationParams } from './query-utils';
import { TournamentEntity } from '../database/entities/tournament.entity';
import { RegistrationEntity } from '../database/entities/registration.entity';
import { requireOwnership, requireRole } from '../middleware/auth.middleware';
import { assertSelfOrAdmin } from './guards';

const TOURNAMENT_MODE_VALUES: TournamentEntity['mode'][] = ['BR', 'CS'];
const TOURNAMENT_STATUS_VALUES: TournamentEntity['status'][] = ['draft', 'published', 'ongoing', 'completed', 'cancelled'];
const REGISTRATION_STATUS_VALUES: RegistrationEntity['status'][] = ['pending', 'confirmed', 'cancelled'];

function coerceTournamentMode(value: unknown): TournamentEntity['mode'] | undefined {
  return typeof value === 'string' && TOURNAMENT_MODE_VALUES.includes(value as TournamentEntity['mode'])
    ? (value as TournamentEntity['mode'])
    : undefined;
}

function coerceTournamentStatus(value: unknown): TournamentEntity['status'] | undefined {
  return typeof value === 'string' && TOURNAMENT_STATUS_VALUES.includes(value as TournamentEntity['status'])
    ? (value as TournamentEntity['status'])
    : undefined;
}

function coerceRegistrationStatus(value: unknown): RegistrationEntity['status'] | undefined {
  return typeof value === 'string' && REGISTRATION_STATUS_VALUES.includes(value as RegistrationEntity['status'])
    ? (value as RegistrationEntity['status'])
    : undefined;
}

export function createTournamentController(services: ServiceContainer): Router {
  const router = Router();

  router.post(
    '/',
    ...requireRole(services, 'organizer', 'admin'),
    asyncHandler(async (req, res) => {
      const dto = await validateDto(CreateTournamentDto, req.body);
      assertSelfOrAdmin(req, dto.organizerId, 'You can only create tournaments for yourself.');
      const tournament = await services.tournamentService.create(dto);
      return sendSuccess(res, tournament, 201);
    }),
  );

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const { page, limit } = getPaginationParams(req);
      const filters: { mode?: TournamentEntity['mode']; status?: TournamentEntity['status'] } = {};
      const mode = coerceTournamentMode(req.query.mode);
      const status = coerceTournamentStatus(req.query.status);
      if (mode) filters.mode = mode;
      if (status) filters.status = status;
      const tournaments = await services.tournamentService.list({ page, limit, filters });
      return sendSuccess(res, tournaments);
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const tournament = await services.tournamentService.findById(req.params.id);
      return sendSuccess(res, tournament);
    }),
  );

  router.patch(
    '/:id',
    ...requireRole(services, 'organizer', 'admin'),
    ...requireOwnership(services, req => services.tournamentService.findById(req.params.id)),
    asyncHandler(async (req, res) => {
      const dto = await validateDto(UpdateTournamentDto, req.body);
      const tournament = await services.tournamentService.update(req.params.id, dto);
      return sendSuccess(res, tournament);
    }),
  );

  router.delete(
    '/:id',
    ...requireRole(services, 'organizer', 'admin'),
    ...requireOwnership(services, req => services.tournamentService.findById(req.params.id)),
    asyncHandler(async (req, res) => {
      await services.tournamentService.delete(req.params.id);
      return sendSuccess(res, { id: req.params.id, deleted: true });
    }),
  );

  router.post(
    '/:id/invites',
    ...requireRole(services, 'organizer', 'admin'),
    ...requireOwnership(services, req => services.tournamentService.findById(req.params.id)),
    asyncHandler(async (req, res) => {
      const dto = await validateDto(InviteTeamDto, req.body);
      await services.tournamentService.inviteTeam(req.params.id, dto.teamId);
      return sendSuccess(res, { invited: true, teamId: dto.teamId, tournamentId: req.params.id });
    }),
  );

  router.delete(
    '/:id/invites/:teamId',
    ...requireRole(services, 'organizer', 'admin'),
    ...requireOwnership(services, req => services.tournamentService.findById(req.params.id)),
    asyncHandler(async (req, res) => {
      await services.tournamentService.removeInvite(req.params.id, req.params.teamId);
      return sendSuccess(res, { removed: true, teamId: req.params.teamId, tournamentId: req.params.id });
    }),
  );

  router.get(
    '/:id/invites',
    ...requireOwnership(services, req => services.tournamentService.findById(req.params.id)),
    asyncHandler(async (req, res) => {
      const teams = await services.tournamentService.listInvitedTeams(req.params.id);
      return sendSuccess(res, teams);
    }),
  );

  router.get(
    '/:id/registrations',
    ...requireOwnership(services, req => services.tournamentService.findById(req.params.id)),
    asyncHandler(async (req, res) => {
      const { page, limit } = getPaginationParams(req);
      const status = coerceRegistrationStatus(req.query.status);
      const filters = status ? { status } : {};
      const registrations = await services.tournamentService.listRegistrations(req.params.id, { page, limit, filters });
      return sendSuccess(res, registrations);
    }),
  );

  router.post(
    '/:id/publish',
    ...requireRole(services, 'organizer', 'admin'),
    ...requireOwnership(services, req => services.tournamentService.findById(req.params.id)),
    asyncHandler(async (req, res) => {
      const tournament = await services.tournamentService.publish(req.params.id);
      return sendSuccess(res, tournament);
    }),
  );

  return router;
}
