import { Request, Router } from 'express';
import { ServiceContainer } from '../services/service-factory';
import { asyncHandler, sendSuccess } from './http-utils';
import { validateDto } from './dto/utils';
import {
  AssignRegistrationTeamDto,
  CreateInvitedRegistrationDto,
  CreateRegistrationDto,
  MarkRegistrationPaidDto,
  UpdateRegistrationDto,
} from './dto/registration.dto';
import { getPaginationParams } from './query-utils';
import { RegistrationEntity } from '../database/entities/registration.entity';
import { UserRole } from '../database/entities/user.entity';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { assertOrganizerOrAdmin, assertTeamOwner } from './guards';

const REG_STATUS: RegistrationEntity['status'][] = ['pending', 'confirmed', 'waitlisted', 'cancelled'];

function coerceRegistrationStatus(value: unknown): RegistrationEntity['status'] | undefined {
  return typeof value === 'string' && REG_STATUS.includes(value as RegistrationEntity['status'])
    ? (value as RegistrationEntity['status'])
    : undefined;
}

export function createRegistrationController(services: ServiceContainer): Router {
  const router = Router();
  const auth = requireAuth(services);
  const organizerOnly = requireRole(services, 'organizer', 'admin');

  const ensureTeamOwnerAccess = async (req: Request, teamId: string) => {
    const team = await services.teamService.findById(teamId);
    assertTeamOwner(req, team, 'Only the team owner may manage registrations for this team.');
    return team;
  };

  const ensureTournamentOrganizerAccess = async (req: Request, tournamentId: string) => {
    const tournament = await services.tournamentService.findById(tournamentId);
    assertOrganizerOrAdmin(req, tournament.organizer.id, 'Only the tournament organizer or admin may perform this action.');
    return tournament;
  };

  const ensureRegistrationAccess = async (req: Request, registrationId: string) => {
    const registration = await services.registrationService.findById(registrationId);
    if (req.user?.role === UserRole.ADMIN) {
      return registration;
    }

    const tournament = await services.tournamentService.findById(registration.tournament.id);
    if (req.user?.role === UserRole.ORGANIZER && tournament.organizer.id === req.user.id) {
      return registration;
    }

    await ensureTeamOwnerAccess(req, registration.team.id);
    return registration;
  };

  router.post(
    '/',
    auth,
    asyncHandler(async (req, res) => {
      const dto = await validateDto(CreateRegistrationDto, req.body);
      await ensureTeamOwnerAccess(req, dto.teamId);
      const registration = await services.registrationService.create(dto);
      return sendSuccess(res, registration, 201);
    }),
  );

  router.post(
    '/invited',
    ...organizerOnly,
    asyncHandler(async (req, res) => {
      const dto = await validateDto(CreateInvitedRegistrationDto, req.body);
      await ensureTournamentOrganizerAccess(req, dto.tournamentId);
      const registration = await services.registrationService.create({ ...dto, invitedSlot: true });
      return sendSuccess(res, registration, 201);
    }),
  );

  router.get(
    '/',
    ...organizerOnly,
    asyncHandler(async (req, res) => {
      const { page, limit } = getPaginationParams(req);
      const filters: { tournamentId?: string; teamId?: string; status?: RegistrationEntity['status'] } = {};
      if (req.query.tournamentId) filters.tournamentId = String(req.query.tournamentId);
      if (req.query.teamId) filters.teamId = String(req.query.teamId);
      const status = coerceRegistrationStatus(req.query.status);
      if (status) filters.status = status;
      const registrations = await services.registrationService.list({ page, limit, filters });
      return sendSuccess(res, registrations);
    }),
  );

  router.get(
    '/:id',
    auth,
    asyncHandler(async (req, res) => {
      const registration = await ensureRegistrationAccess(req, req.params.id);
      return sendSuccess(res, registration);
    }),
  );

  router.patch(
    '/:id',
    auth,
    asyncHandler(async (req, res) => {
      await ensureRegistrationAccess(req, req.params.id);
      const dto = await validateDto(UpdateRegistrationDto, req.body);
      const registration = await services.registrationService.update(req.params.id, dto);
      return sendSuccess(res, registration);
    }),
  );

  router.delete(
    '/:id',
    auth,
    asyncHandler(async (req, res) => {
      await ensureRegistrationAccess(req, req.params.id);
      await services.registrationService.delete(req.params.id);
      return sendSuccess(res, { id: req.params.id, deleted: true });
    }),
  );

  router.post(
    '/:id/confirm',
    auth,
    asyncHandler(async (req, res) => {
      await ensureRegistrationAccess(req, req.params.id);
      const registration = await services.registrationService.confirm(req.params.id);
      return sendSuccess(res, registration);
    }),
  );

  router.post(
    '/:id/cancel',
    auth,
    asyncHandler(async (req, res) => {
      await ensureRegistrationAccess(req, req.params.id);
      const allowAfterStart = req.user?.role === UserRole.ADMIN;
      const registration = await services.registrationService.cancel(req.params.id, { allowAfterStart });
      return sendSuccess(res, registration);
    }),
  );

  router.post(
    '/:id/mark-paid',
    ...organizerOnly,
    asyncHandler(async (req, res) => {
      await ensureRegistrationAccess(req, req.params.id);
      const dto = await validateDto(MarkRegistrationPaidDto, req.body);
      const registration = await services.registrationService.markPaid(req.params.id, dto.paymentRecordId);
      return sendSuccess(res, registration);
    }),
  );

  router.post(
    '/:id/assign-team',
    ...organizerOnly,
    asyncHandler(async (req, res) => {
      const dto = await validateDto(AssignRegistrationTeamDto, req.body);
      const registration = await services.registrationService.assignTeam(req.params.id, dto.teamId);
      return sendSuccess(res, registration);
    }),
  );

  return router;
}
