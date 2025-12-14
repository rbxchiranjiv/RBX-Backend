import { Router } from 'express';
import { ServiceContainer } from '../services/service-factory';
import { asyncHandler, sendSuccess } from './http-utils';
import { validateDto } from './dto/utils';
import { CreateTeamDto, ModifyTeamMemberDto, UpdateTeamDto } from './dto/team.dto';
import { getPaginationParams } from './query-utils';
import { requireAuth, requireOwnership } from '../middleware/auth.middleware';
import { assertSelfOrAdmin, assertTeamMembership } from './guards';

export function createTeamController(services: ServiceContainer): Router {
  const router = Router();
  const auth = requireAuth(services);

  router.post(
    '/',
    auth,
    asyncHandler(async (req, res) => {
      const dto = await validateDto(CreateTeamDto, req.body);
      assertSelfOrAdmin(req, dto.ownerId, 'You can only create teams for yourself.');
      const team = await services.teamService.create(dto);
      return sendSuccess(res, team, 201);
    }),
  );

  router.get(
    '/',
    auth,
    asyncHandler(async (req, res) => {
      const { page, limit } = getPaginationParams(req);
      const filters: { ownerId?: string; region?: string } = {};
      if (req.query.ownerId) filters.ownerId = String(req.query.ownerId);
      if (req.query.region) filters.region = String(req.query.region);
      const result = await services.teamService.list({ page, limit, filters });
      return sendSuccess(res, result);
    }),
  );

  router.get(
    '/user/:userId',
    auth,
    asyncHandler(async (req, res) => {
      assertSelfOrAdmin(req, req.params.userId, 'You can only list your own teams.');
      const teams = await services.teamService.listTeamsForUser(req.params.userId);
      return sendSuccess(res, teams);
    }),
  );

  router.get(
    '/:id',
    auth,
    asyncHandler(async (req, res) => {
      const team = await services.teamService.findById(req.params.id);
      assertTeamMembership(req, team, 'Only team members can view details.');
      return sendSuccess(res, team);
    }),
  );

  router.patch(
    '/:id',
    ...requireOwnership(services, req => services.teamService.findById(req.params.id)),
    asyncHandler(async (req, res) => {
      const dto = await validateDto(UpdateTeamDto, req.body);
      const team = await services.teamService.update(req.params.id, dto);
      return sendSuccess(res, team);
    }),
  );

  router.delete(
    '/:id',
    ...requireOwnership(services, req => services.teamService.findById(req.params.id)),
    asyncHandler(async (req, res) => {
      await services.teamService.delete(req.params.id);
      return sendSuccess(res, { id: req.params.id, deleted: true });
    }),
  );

  router.post(
    '/:id/members',
    ...requireOwnership(services, req => services.teamService.findById(req.params.id)),
    asyncHandler(async (req, res) => {
      const dto = await validateDto(ModifyTeamMemberDto, req.body);
      const team = await services.teamService.addMember(req.params.id, dto.userId);
      return sendSuccess(res, team);
    }),
  );

  router.delete(
    '/:id/members/:userId',
    ...requireOwnership(services, req => services.teamService.findById(req.params.id)),
    asyncHandler(async (req, res) => {
      const team = await services.teamService.removeMember(req.params.id, req.params.userId);
      return sendSuccess(res, team);
    }),
  );

  router.get(
    '/:id/members',
    auth,
    asyncHandler(async (req, res) => {
      const team = await services.teamService.findById(req.params.id);
      assertTeamMembership(req, team, 'Only members can view teammates.');
      return sendSuccess(res, team.members);
    }),
  );

  return router;
}
