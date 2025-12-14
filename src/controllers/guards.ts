import { Request } from 'express';
import { AuthenticationError, AuthorizationError } from '../services/errors';
import { TeamEntity } from '../database/entities/team.entity';
import { UserRole } from '../database/entities/user.entity';

export function assertAuthenticated(req: Request) {
  if (!req.user) {
    throw new AuthenticationError();
  }
  return req.user;
}

export function assertSelfOrAdmin(req: Request, targetUserId: string, message = 'You are not allowed to perform this action.') {
  const user = assertAuthenticated(req);
  if (user.role === UserRole.ADMIN) {
    return;
  }
  if (user.id !== targetUserId) {
    throw new AuthorizationError(message);
  }
}

export function assertAdmin(req: Request) {
  const user = assertAuthenticated(req);
  if (user.role !== UserRole.ADMIN) {
    throw new AuthorizationError('Admin privileges required.');
  }
}

export function assertOrganizerOrAdmin(
  req: Request,
  organizerId: string,
  message = 'Only the organizer or an admin can perform this action.',
) {
  const user = assertAuthenticated(req);
  if (user.role === UserRole.ADMIN) {
    return;
  }
  if (user.id !== organizerId) {
    throw new AuthorizationError(message);
  }
}

export function assertTeamMembership(
  req: Request,
  team: Pick<TeamEntity, 'owner'> & Partial<Pick<TeamEntity, 'members'>>,
  message = 'You must be part of this team to proceed.',
) {
  const user = assertAuthenticated(req);
  if (user.role === UserRole.ADMIN) {
    return;
  }
  const isOwner = team.owner?.id === user.id;
  const isMember = Boolean(team.members?.some(member => member.id === user.id));
  if (!isOwner && !isMember) {
    throw new AuthorizationError(message);
  }
}

export function assertTeamOwner(
  req: Request,
  team: Pick<TeamEntity, 'owner'>,
  message = 'Only the team owner can perform this action.',
) {
  const user = assertAuthenticated(req);
  if (user.role === UserRole.ADMIN) {
    return;
  }
  if (team.owner?.id !== user.id) {
    throw new AuthorizationError(message);
  }
}
