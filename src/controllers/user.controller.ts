import { Router } from 'express';
import { ServiceContainer } from '../services/service-factory';
import { asyncHandler, sendSuccess } from './http-utils';
import { validateDto } from './dto/utils';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { getPaginationParams } from './query-utils';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { assertSelfOrAdmin } from './guards';

export function createUserController(services: ServiceContainer): Router {
  const router = Router();

  router.post(
    '/',
    ...requireRole(services, 'admin'),
    asyncHandler(async (req, res) => {
      const dto = await validateDto(CreateUserDto, req.body);
      const user = await services.userService.create(dto);
      return sendSuccess(res, user, 201);
    }),
  );

  router.get(
    '/',
    ...requireRole(services, 'admin'),
    asyncHandler(async (req, res) => {
      const { page, limit } = getPaginationParams(req);
      const filters: Record<string, unknown> = {};
      if (req.query.role) {
        filters.role = req.query.role;
      }
      if (req.query.phoneNumber) {
        filters.phoneNumber = req.query.phoneNumber;
      }
      const result = await services.userService.list({ page, limit, filters });
      return sendSuccess(res, result);
    }),
  );

  router.get(
    '/:id',
    requireAuth(services),
    asyncHandler(async (req, res) => {
      assertSelfOrAdmin(req, req.params.id, 'You may only view your own user record.');
      const user = await services.userService.findById(req.params.id);
      return sendSuccess(res, user);
    }),
  );

  router.patch(
    '/:id',
    requireAuth(services),
    asyncHandler(async (req, res) => {
      assertSelfOrAdmin(req, req.params.id, 'You may only update your own profile.');
      const dto = await validateDto(UpdateUserDto, req.body);
      const user = await services.userService.update(req.params.id, dto);
      return sendSuccess(res, user);
    }),
  );

  router.delete(
    '/:id',
    requireAuth(services),
    asyncHandler(async (req, res) => {
      assertSelfOrAdmin(req, req.params.id, 'You may only delete your own profile.');
      await services.userService.delete(req.params.id);
      return sendSuccess(res, { id: req.params.id, deleted: true });
    }),
  );

  return router;
}
