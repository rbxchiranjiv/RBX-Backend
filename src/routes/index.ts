import { Router } from 'express';
import { ServiceContainer } from '../services/service-factory';
import { createUserController } from '../controllers/user.controller';
import { createTeamController } from '../controllers/team.controller';
import { createTournamentController } from '../controllers/tournament.controller';
import { createRegistrationController } from '../controllers/registration.controller';
import { createMatchController } from '../controllers/match.controller';
import { createPaymentRecordController } from '../controllers/payment-record.controller';
import { createNotificationController } from '../controllers/notification.controller';
import { createAuthController } from '../controllers/auth.controller';
import { createLeaderboardController } from '../controllers/leaderboard.controller.factory';
import type { DataSource } from 'typeorm';

export function createApiRouter(services: ServiceContainer, dataSource: DataSource): Router {
  const router = Router();

  router.use('/users', createUserController(services));
  router.use('/teams', createTeamController(services));
  router.use('/tournaments', createTournamentController(services));
  router.use('/registrations', createRegistrationController(services));
  router.use('/matches', createMatchController(services));
  router.use('/payment-records', createPaymentRecordController(services));
  router.use('/notifications', createNotificationController(services));
  router.use('/auth', createAuthController(services));
  router.use('/leaderboard', createLeaderboardController(dataSource));

  return router;
}
