import { Router } from 'express';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from '../services/leaderboard.service';
import { StandingsService } from '../services/standings.service';
import { SeasonAggregationService } from '../services/season-aggregation.service';
import { UserRole } from '../database/entities/user.entity';
import type { DataSource } from 'typeorm';

// Mock auth middleware for now
const requireAuth = (req: any, res: any, next: any) => next();
const requireRole = (...roles: any[]) => (req: any, res: any, next: any) => next();

export function createLeaderboardController(dataSource: DataSource): Router {
  const router = Router();

  // Initialize services
  const leaderboardService = new LeaderboardService(
    dataSource.getRepository('LeaderboardSnapshotEntity'),
    dataSource.getRepository('StandingEntity'),
    dataSource.getRepository('TournamentEntity'),
    dataSource.getRepository('TeamEntity'),
    dataSource.getRepository('UserEntity'),
    dataSource,
  );

  const standingsService = new StandingsService(
    dataSource.getRepository('StandingEntity'),
    dataSource.getRepository('TournamentEntity'),
    dataSource.getRepository('TeamEntity'),
    dataSource.getRepository('UserEntity'),
    dataSource.getRepository('MatchEntity'),
    dataSource.getRepository('RegistrationEntity'),
    dataSource,
  );

  const seasonAggregationService = new SeasonAggregationService(
    dataSource.getRepository('SeasonStatsEntity'),
    dataSource.getRepository('StandingEntity'),
    dataSource.getRepository('TournamentEntity'),
    dataSource.getRepository('MatchEntity'),
    dataSource.getRepository('TeamEntity'),
    dataSource.getRepository('UserEntity'),
    dataSource.getRepository('RegistrationEntity'),
    dataSource,
  );

  const controller = new LeaderboardController(
    leaderboardService,
    standingsService,
    seasonAggregationService,
  );

  // Public routes
  router.get('/global', controller.getGlobalLeaderboard.bind(controller));
  router.get('/season/:seasonId', controller.getSeasonLeaderboard.bind(controller));
  router.get('/tournament/:tournamentId', controller.getTournamentLeaderboard.bind(controller));
  router.get('/standings/:tournamentId', controller.getTournamentStandings.bind(controller));
  router.get('/season-stats/:participantId', controller.getSeasonStats.bind(controller));
  router.get('/top-season-stats', controller.getTopSeasonStats.bind(controller));
  router.get('/history/:participantId', controller.getSeasonHistory.bind(controller));
  router.get('/season/:seasonId/summary', controller.getSeasonSummary.bind(controller));

  // Protected routes
  router.post('/refresh', 
    requireAuth,
    requireRole('admin', 'organizer'),
    controller.refreshLeaderboard.bind(controller)
  );

  router.get('/organizer/stats',
    requireAuth,
    requireRole('organizer', 'admin'),
    controller.getOrganizerStats.bind(controller)
  );

  return router;
}
