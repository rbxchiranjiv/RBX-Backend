import type { UserEntity } from '../database/entities/user.entity';
import type { UserRole } from '../database/entities/user.entity';

declare global {
  namespace Express {
    interface AuthenticatedUser {
      id: string;
      role: UserRole;
    }

    interface Request {
      user?: AuthenticatedUser;
      currentUser?: UserEntity;
    }
  }
}

export {};
