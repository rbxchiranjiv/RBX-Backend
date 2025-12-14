import { Router } from 'express';
import { ServiceContainer } from '../services/service-factory';
import { asyncHandler, sendSuccess } from './http-utils';
import { validateDto } from './dto/utils';
import { LoginDto, RefreshDto, LogoutDto } from './dto/auth.dto';

export function createAuthController(services: ServiceContainer): Router {
  const router = Router();

  router.post(
    '/login',
    asyncHandler(async (req, res) => {
      const dto = await validateDto(LoginDto, req.body);
      const result = await services.authService.login(dto.phoneNumber);
      return sendSuccess(res, result);
    }),
  );

  router.post(
    '/refresh',
    asyncHandler(async (req, res) => {
      const dto = await validateDto(RefreshDto, req.body);
      const result = await services.authService.refresh(dto.refreshToken);
      return sendSuccess(res, result);
    }),
  );

  router.post(
    '/logout',
    asyncHandler(async (req, res) => {
      const dto = await validateDto(LogoutDto, req.body);
      await services.authService.revokeRefreshToken(dto.refreshToken);
      return sendSuccess(res, { revoked: true });
    }),
  );

  return router;
}
