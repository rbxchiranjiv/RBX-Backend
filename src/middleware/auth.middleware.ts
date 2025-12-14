import { NextFunction, Request, Response } from 'express';
import type { ServiceContainer } from '../services/service-factory';
import { UserRole } from '../database/entities/user.entity';
import { AuthenticationError, AuthorizationError, NotFoundError } from '../services/errors';

type Role = UserRole;
export type OwnershipResolver<T = unknown> = (req: Request, services: ServiceContainer) => Promise<T>;

export function requireAuth(services: ServiceContainer) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AuthenticationError();
      }
      const token = authHeader.slice(7);
      const payload = services.authService.verifyAccessToken(token);
      const user = await services.userService.findById(payload.sub);
      req.user = { id: user.id, role: user.role };
      req.currentUser = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireRole(services: ServiceContainer, ...roles: Role[]) {
  return [
    requireAuth(services),
    (req: Request, _res: Response, next: NextFunction) => {
      if (!req.user) {
        return next(new AuthenticationError());
      }
      if (req.user.role === UserRole.ADMIN) {
        return next();
      }
      if (!roles.includes(req.user.role)) {
        return next(new AuthorizationError());
      }
      next();
    },
  ];
}

export function requireOwnership<
  T extends { ownerId?: string; owner?: { id: string }; organizer?: { id: string }; userId?: string },
>(
  services: ServiceContainer,
  resolver: OwnershipResolver<T>,
) {
  return [
    requireAuth(services),
    async (req: Request, _res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          throw new AuthenticationError();
        }
        if (req.user.role === UserRole.ADMIN) {
          return next();
        }
        const resource = await resolver(req, services);
        if (!resource) {
          throw new NotFoundError('Resource', req.params.id ?? 'unknown');
        }
        const ownerId = resource.ownerId ?? resource.owner?.id ?? resource.organizer?.id ?? resource.userId;
        if (!ownerId) {
          throw new AuthorizationError();
        }
        if (ownerId !== req.user.id) {
          throw new AuthorizationError();
        }
        next();
      } catch (error) {
        next(error);
      }
    },
  ];
}
