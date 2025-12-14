import { Router } from 'express';
import { ServiceContainer } from '../services/service-factory';
import { asyncHandler, sendSuccess } from './http-utils';
import { validateDto } from './dto/utils';
import {
  AssignParticipantsDto,
  CreateMatchDto,
  ScheduleMatchDto,
  UpdateMatchDto,
} from './dto/match.dto';
import { getPaginationParams } from './query-utils';
import { MatchEntity } from '../database/entities/match.entity';
import { UserRole } from '../database/entities/user.entity';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { assertAuthenticated, assertOrganizerOrAdmin } from './guards';
import {
  CreateMatchDisputeDto,
  EndMatchDto,
  FinalizeMatchDto,
  ForfeitMatchDto,
  RecordProofDto,
  ResolveMatchDisputeDto,
  RevertMatchDto,
  StartMatchDto,
} from './dto/match-lifecycle.dto';
import type { ActorContext } from '../services/match-lifecycle.service';
import type { MatchDisputeStatus } from '../database/entities/match-dispute.entity';
import { AuthorizationError, ValidationError } from '../services/errors';

const MATCH_STATUS: MatchEntity['status'][] = [
  'scheduled',
  'ongoing',
  'ended',
  'disputed',
  'resolving',
  'result_confirmed',
  'cancelled',
];

const DISPUTE_STATUS: MatchDisputeStatus[] = ['open', 'resolving', 'resolved'];

type HandlerRequest = Parameters<ReturnType<typeof asyncHandler>>[0];

function coerceMatchStatus(value: unknown): MatchEntity['status'] | undefined {
  return typeof value === 'string' && MATCH_STATUS.includes(value as MatchEntity['status'])
    ? (value as MatchEntity['status'])
    : undefined;
}

function coerceDisputeStatus(value: unknown): MatchDisputeStatus | undefined {
  return typeof value === 'string' && DISPUTE_STATUS.includes(value as MatchDisputeStatus)
    ? (value as MatchDisputeStatus)
    : undefined;
}

function getActorContext(req: HandlerRequest): ActorContext {
  const user = assertAuthenticated(req);
  return { id: user.id, role: user.role };
}

export function createMatchController(services: ServiceContainer): Router {
  const router = Router();
  const auth = requireAuth(services);
  const organizerRole = requireRole(services, 'organizer', 'admin');
  const adminRole = requireRole(services, 'admin');
  const lifecycleService = services.matchLifecycleService;

  const ensureTournamentOrganizer = async (req: Parameters<ReturnType<typeof asyncHandler>>[0], tournamentId: string) => {
    if (req.user?.role === UserRole.ADMIN) {
      return;
    }
    const tournament = await services.tournamentService.findById(tournamentId);
    assertOrganizerOrAdmin(req, tournament.organizer.id, 'Only the organizer may manage matches for this tournament.');
  };

  const ensureMatchOrganizer = async (req: Parameters<ReturnType<typeof asyncHandler>>[0], matchId: string) => {
    const match = await services.matchService.findById(matchId);
    await ensureTournamentOrganizer(req, match.tournament.id);
    return match;
  };

  router.post(
    '/',
    ...organizerRole,
    asyncHandler(async (req, res) => {
      const dto = await validateDto(CreateMatchDto, req.body);
      await ensureTournamentOrganizer(req, dto.tournamentId);
      const match = await services.matchService.create(dto);
      return sendSuccess(res, match, 201);
    }),
  );

  router.get(
    '/',
    auth,
    asyncHandler(async (req, res) => {
      const { page, limit } = getPaginationParams(req);
      const filters: { tournamentId?: string; status?: MatchEntity['status'] } = {};
      if (req.query.tournamentId) filters.tournamentId = String(req.query.tournamentId);
      const status = coerceMatchStatus(req.query.status);
      if (status) filters.status = status;
      const matches = await services.matchService.list({ page, limit, filters });
      return sendSuccess(res, matches);
    }),
  );

  router.get(
    '/tournament/:tournamentId',
    auth,
    asyncHandler(async (req, res) => {
      const { page, limit } = getPaginationParams(req);
      const filters = req.query.status ? { status: coerceMatchStatus(req.query.status) } : undefined;
      const statusFilter = filters?.status ? { status: filters.status } : undefined;
      const result = await services.matchService.listByTournament(req.params.tournamentId, {
        page,
        limit,
        filters: statusFilter,
      });
      return sendSuccess(res, result);
    }),
  );

  // Temporarily disabled to avoid pg-mem disputes relation issues
  // router.get(
  //   '/:id',
  //   auth,
  //   asyncHandler(async (req, res) => {
  //     const match = await services.matchService.findById(req.params.id);
  //     return sendSuccess(res, match);
  //   }),
  // );

  router.patch(
    '/:id',
    ...organizerRole,
    asyncHandler(async (req, res) => {
      await ensureMatchOrganizer(req, req.params.id);
      const dto = await validateDto(UpdateMatchDto, req.body);
      const match = await services.matchService.update(req.params.id, dto);
      return sendSuccess(res, match);
    }),
  );

  router.delete(
    '/:id',
    ...organizerRole,
    asyncHandler(async (req, res) => {
      await ensureMatchOrganizer(req, req.params.id);
      await services.matchService.delete(req.params.id);
      return sendSuccess(res, { id: req.params.id, deleted: true });
    }),
  );

  router.post(
    '/tournaments/:tournamentId/schedule',
    ...organizerRole,
    asyncHandler(async (req, res) => {
      await ensureTournamentOrganizer(req, req.params.tournamentId);
      const dto = await validateDto(ScheduleMatchDto, req.body);
      const match = await services.matchService.schedule(req.params.tournamentId, dto);
      return sendSuccess(res, match, 201);
    }),
  );

  router.post(
    '/:id/start',
    ...organizerRole,
    asyncHandler(async (req, res) => {
      await ensureMatchOrganizer(req, req.params.id);
      const dto = await validateDto(StartMatchDto, req.body ?? {});
      const match = await lifecycleService.startMatch(req.params.id, getActorContext(req), dto);
      return sendSuccess(res, match);
    }),
  );

  router.post(
    '/:id/end',
    ...organizerRole,
    asyncHandler(async (req, res) => {
      await ensureMatchOrganizer(req, req.params.id);
      const dto = await validateDto(EndMatchDto, req.body);
      const match = await lifecycleService.endMatch(req.params.id, getActorContext(req), dto);
      return sendSuccess(res, match);
    }),
  );

  router.post(
    '/:id/forfeit',
    ...organizerRole,
    asyncHandler(async (req, res) => {
      await ensureMatchOrganizer(req, req.params.id);
      const dto = await validateDto(ForfeitMatchDto, req.body);
      const match = await lifecycleService.forfeitMatch(req.params.id, getActorContext(req), dto);
      return sendSuccess(res, match);
    }),
  );

  router.post(
    '/:id/finalize',
    ...adminRole,
    asyncHandler(async (req, res) => {
      const dto = await validateDto(FinalizeMatchDto, req.body ?? {});
      const match = await lifecycleService.finalizeMatch(req.params.id, getActorContext(req), dto);
      return sendSuccess(res, match);
    }),
  );

  router.post(
    '/:id/revert',
    ...adminRole,
    asyncHandler(async (req, res) => {
      const dto = await validateDto(RevertMatchDto, req.body ?? {});
      const match = await lifecycleService.revertMatch(req.params.id, getActorContext(req), dto.reason);
      return sendSuccess(res, match);
    }),
  );

  router.post(
    '/:id/participants',
    ...organizerRole,
    asyncHandler(async (req, res) => {
      await ensureMatchOrganizer(req, req.params.id);
      const dto = await validateDto(AssignParticipantsDto, req.body);
      const match = await services.matchService.assignParticipants(req.params.id, dto.teamIds);
      return sendSuccess(res, match);
    }),
  );

  router.post(
    '/:id/proofs',
    auth,
    asyncHandler(async (req, res) => {
      const dto = await validateDto(RecordProofDto, req.body);
      const actor = getActorContext(req);
      const match = await lifecycleService.getMatchWithDetails(req.params.id, actor);
      const isOrganizer = match.tournament.organizer.id === actor.id || actor.role === UserRole.ADMIN;
      if (!isOrganizer) {
        if (!dto.teamId) {
          throw new ValidationError('teamId is required when uploading proofs as a participant.');
        }
        const ownsTeam = match.participants.some(team => team.id === dto.teamId && team.owner?.id === actor.id);
        if (!ownsTeam) {
          throw new AuthorizationError('You may only upload proofs for your own team.');
        }
      }
      const proof = await lifecycleService.recordProof(match.id, actor, dto);
      return sendSuccess(res, proof, 201);
    }),
  );

  router.post(
    '/:id/disputes',
    auth,
    asyncHandler(async (req, res) => {
      const dto = await validateDto(CreateMatchDisputeDto, req.body);
      const dispute = await lifecycleService.createDispute(req.params.id, getActorContext(req), dto);
      return sendSuccess(res, dispute, 201);
    }),
  );

  router.get(
    '/disputes',
    ...adminRole,
    asyncHandler(async (req, res) => {
      const status = req.query.status ? coerceDisputeStatus(req.query.status) : undefined;
      if (req.query.status && !status) {
        throw new ValidationError('Invalid dispute status filter.');
      }
      const disputes = await lifecycleService.listDisputes(status);
      return sendSuccess(res, disputes);
    }),
  );

  router.post(
    '/disputes/:disputeId/resolve',
    ...adminRole,
    asyncHandler(async (req, res) => {
      const dto = await validateDto(ResolveMatchDisputeDto, req.body);
      const dispute = await lifecycleService.resolveDispute(req.params.disputeId, getActorContext(req), dto);
      return sendSuccess(res, dispute);
    }),
  );

  return router;
}
