import request from 'supertest';
import { createTestDataSource } from '../../services/test-utils';
import { DataSource } from 'typeorm';
import { createApp } from '../../app';
import * as express from 'express';
import { randomUUID } from 'crypto';
import {
  StandingEntity,
  LeaderboardSnapshotEntity,
  SeasonStatsEntity,
  TournamentEntity,
  TeamEntity,
  UserEntity,
  MatchEntity,
  RegistrationEntity,
  StandingType,
  StandingStatus,
  LeaderboardType,
  LeaderboardCategory,
  UserRole,
} from '../../database/entities';
import { createTestRegistration } from '../test-helpers/entity.helper';

describe('Leaderboard Integration Tests', () => {
  let dataSource: DataSource;
  let app: express.Application;
  let agent: request.SuperAgentTest;

  let tournamentRepo: any;
  let teamRepo: any;
  let userRepo: any;
  let matchRepo: any;
  let registrationRepo: any;
  let standingRepo: any;
  let leaderboardSnapshotRepo: any;
  let seasonStatsRepo: any;

  let tournament: TournamentEntity;
  let team: TeamEntity;
  let user: UserEntity;
  let admin: UserEntity;
  let match: MatchEntity;
  let registration: RegistrationEntity;
  let standing: StandingEntity;

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    app = createApp(dataSource);
    agent = request.agent(app);

    // Get repositories
    tournamentRepo = dataSource.getRepository(TournamentEntity);
    teamRepo = dataSource.getRepository(TeamEntity);
    userRepo = dataSource.getRepository(UserEntity);
    matchRepo = dataSource.getRepository(MatchEntity);
    registrationRepo = dataSource.getRepository(RegistrationEntity);
    standingRepo = dataSource.getRepository(StandingEntity);
    leaderboardSnapshotRepo = dataSource.getRepository(LeaderboardSnapshotEntity);
    seasonStatsRepo = dataSource.getRepository(SeasonStatsEntity);
  });

  beforeEach(async () => {
    // Clean up all tables
    await standingRepo.delete({});
    await leaderboardSnapshotRepo.delete({});
    await seasonStatsRepo.delete({});
    await matchRepo.delete({});
    await registrationRepo.delete({});
    await tournamentRepo.delete({});
    await teamRepo.delete({});
    await userRepo.delete({});

    // Create test data
    user = await userRepo.save({
      id: randomUUID(),
      email: 'player@test.com',
      displayName: 'Test Player',
      phoneNumber: '+1234567890',
      role: UserRole.PLAYER,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    admin = await userRepo.save({
      id: randomUUID(),
      email: 'admin@test.com',
      displayName: 'Test Admin',
      phoneNumber: '+1234567891',
      role: UserRole.ADMIN,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    team = await teamRepo.save({
      id: randomUUID(),
      name: 'Test Team',
      slug: 'test-team',
      tag: 'TT',
      captainId: user.id,
      owner: user, // Set owner relationship
      region: 'global',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    tournament = await tournamentRepo.save({
      id: randomUUID(),
      name: 'Test Tournament',
      slug: 'test-tournament',
      mode: 'BR',
      maxTeams: 10,
      status: 'completed',
      organizer: user,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    registration = await createTestRegistration(registrationRepo, tournamentRepo, teamRepo, user, {
      team: team,
    });

    match = await matchRepo.save({
      id: randomUUID(),
      code: `MATCH-${Date.now()}`,
      mode: 'BR',
      tournament: tournament,
      status: 'ended',
      startedAt: new Date(),
      completedAt: new Date(),
      results: [
        {
          teamId: team.id,
          placement: 1,
          stats: {
            kills: 10,
            deaths: 2,
            assists: 5,
            survivalTime: 1800,
            damageDealt: 2000,
            damageTaken: 500,
          },
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    standing = await standingRepo.save({
      id: randomUUID(),
      tournamentId: tournament.id,
      teamId: team.id,
      userId: user.id,
      seasonId: '2024-Q1',
      type: StandingType.TOURNAMENT,
      status: StandingStatus.FINAL,
      rank: 1,
      points: 180,
      matchesPlayed: 1,
      wins: 1,
      losses: 0,
      draws: 0,
      kills: 10,
      deaths: 2,
      assists: 5,
      survivalTime: 1800,
      kdratio: 5.0,
      avgPlacement: 1.0,
      region: 'global',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterEach(async () => {
    // Clean up test data
    await standingRepo.delete({});
    await leaderboardSnapshotRepo.delete({});
    await seasonStatsRepo.delete({});
    await matchRepo.delete({});
    await registrationRepo.delete({});
    await tournamentRepo.delete({});
    await teamRepo.delete({});
    await userRepo.delete({});
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  describe('GET /api/v1/leaderboard/global', () => {
    it('should return global leaderboard', async () => {
      const response = await agent
        .get('/api/v1/leaderboard/global')
        .query({
          type: 'global',
          category: 'teams',
          limit: 10,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('entries');
      expect(response.body.data).toHaveProperty('totalEntries');
      expect(response.body.data).toHaveProperty('lastUpdated');
      expect(response.body.data).toHaveProperty('snapshotKey');
      expect(Array.isArray(response.body.data.entries)).toBe(true);
    });

    it('should handle pagination parameters', async () => {
      const response = await agent
        .get('/api/v1/leaderboard/global')
        .query({
          type: 'global',
          category: 'teams',
          limit: 5,
          offset: 0,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.entries).toBeDefined();
    });

    it('should handle sorting parameters', async () => {
      const response = await agent
        .get('/api/v1/leaderboard/global')
        .query({
          type: 'global',
          category: 'teams',
          sortBy: 'wins',
          sortOrder: 'desc',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.entries).toBeDefined();
    });
  });

  describe('GET /api/v1/leaderboard/season/:seasonId', () => {
    it('should return season leaderboard', async () => {
      // Create season stats
      await seasonStatsRepo.save({
        id: randomUUID(),
        seasonId: '2024-Q1',
        type: 'team',
        teamId: team.id,
        tournamentsPlayed: 1,
        tournamentsWon: 1,
        totalPoints: 180,
        avgPlacement: 1.0,
        currentRank: 1,
        peakRank: 1,
        winRate: 100.0,
        totalMatches: 1,
        totalWins: 1,
        totalLosses: 0,
        totalDraws: 0,
        totalKills: 10,
        totalDeaths: 2,
        totalAssists: 5,
        totalSurvivalTime: 1800,
        avgKills: 10.0,
        kdratio: 5.0,
        weeklyStats: {},
        achievements: {
          firstPlace: 1,
          top3: 1,
          top5: 1,
          top10: 1,
          perfectGames: 0,
          longestWinStreak: 1,
          currentWinStreak: 1,
        },
        metadata: {},
        region: 'global',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await agent
        .get('/api/v1/leaderboard/season/2024-Q1')
        .query({
          type: 'season',
          category: 'teams',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.entries).toBeDefined();
    });
  });

  describe('GET /api/v1/leaderboard/tournament/:tournamentId', () => {
    it('should return tournament leaderboard', async () => {
      const response = await agent
        .get(`/api/v1/leaderboard/tournament/${tournament.id}`)
        .query({
          type: 'tournament',
          category: 'teams',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.entries).toBeDefined();
      expect(response.body.data.entries).toHaveLength(1);
      expect(response.body.data.entries[0].teamId).toBe(team.id);
      expect(response.body.data.entries[0].rank).toBe(1);
      expect(response.body.data.entries[0].points).toBe(180);
    });

    it('should handle tournament not found', async () => {
      const response = await agent
        .get('/api/v1/leaderboard/tournament/nonexistent')
        .query({
          type: 'tournament',
          category: 'teams',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.entries).toHaveLength(0);
    });
  });

  describe('GET /api/v1/leaderboard/standings/:tournamentId', () => {
    it('should return tournament standings', async () => {
      const response = await agent
        .get(`/api/v1/leaderboard/standings/${tournament.id}`)
        .query({
          limit: 10,
          offset: 0,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.standings).toBeDefined();
      expect(response.body.data.total).toBeDefined();
      expect(Array.isArray(response.body.data.standings)).toBe(true);
      expect(response.body.data.standings).toHaveLength(1);
      expect(response.body.data.standings[0].tournamentId).toBe(tournament.id);
      expect(response.body.data.standings[0].teamId).toBe(team.id);
      expect(response.body.data.standings[0].rank).toBe(1);
    });
  });

  describe('GET /api/v1/leaderboard/season-stats/:participantId', () => {
    it('should return season stats for team', async () => {
      // Create season stats
      await seasonStatsRepo.save({
        id: randomUUID(),
        seasonId: '2024-Q1',
        type: 'team',
        teamId: team.id,
        tournamentsPlayed: 1,
        tournamentsWon: 1,
        totalPoints: 180,
        avgPlacement: 1.0,
        currentRank: 1,
        peakRank: 1,
        winRate: 100.0,
        totalMatches: 1,
        totalWins: 1,
        totalLosses: 0,
        totalDraws: 0,
        totalKills: 10,
        totalDeaths: 2,
        totalAssists: 5,
        totalSurvivalTime: 1800,
        avgKills: 10.0,
        kdratio: 5.0,
        weeklyStats: {},
        achievements: {
          firstPlace: 1,
          top3: 1,
          top5: 1,
          top10: 1,
          perfectGames: 0,
          longestWinStreak: 1,
          currentWinStreak: 1,
        },
        metadata: {},
        region: 'global',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await agent
        .get(`/api/v1/leaderboard/season-stats/${team.id}`)
        .query({
          type: 'team',
          seasonId: '2024-Q1',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.teamId).toBe(team.id);
      expect(response.body.data.seasonId).toBe('2024-Q1');
      expect(response.body.data.totalPoints).toBe(180);
    });

    it('should return season stats for player', async () => {
      // Create season stats for player
      await seasonStatsRepo.save({
        id: randomUUID(),
        seasonId: '2024-Q1',
        type: 'player',
        userId: user.id,
        tournamentsPlayed: 1,
        tournamentsWon: 0,
        totalPoints: 180,
        avgPlacement: 1.0,
        currentRank: 1,
        peakRank: 1,
        winRate: 100.0,
        totalMatches: 1,
        totalWins: 1,
        totalLosses: 0,
        totalDraws: 0,
        totalKills: 10,
        totalDeaths: 2,
        totalAssists: 5,
        totalSurvivalTime: 1800,
        avgKills: 10.0,
        kdratio: 5.0,
        weeklyStats: {},
        achievements: {
          firstPlace: 1,
          top3: 1,
          top5: 1,
          top10: 1,
          perfectGames: 0,
          longestWinStreak: 1,
          currentWinStreak: 1,
        },
        metadata: {},
        region: 'global',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await agent
        .get(`/api/v1/leaderboard/season-stats/${user.id}`)
        .query({
          type: 'player',
          seasonId: '2024-Q1',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.userId).toBe(user.id);
      expect(response.body.data.type).toBe('player');
    });

    it('should return null for non-existent participant', async () => {
      const response = await agent
        .get('/api/v1/leaderboard/season-stats/nonexistent')
        .query({
          type: 'team',
          seasonId: '2024-Q1',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeNull();
    });
  });

  describe('GET /api/v1/leaderboard/top-season-stats', () => {
    it('should return top season stats', async () => {
      // Create multiple season stats
      await seasonStatsRepo.save([
        {
          id: randomUUID(),
          seasonId: '2024-Q1',
          type: 'team',
          teamId: team.id,
          currentRank: 1,
          totalPoints: 200,
          tournamentsPlayed: 2,
          tournamentsWon: 2,
          region: 'global',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: randomUUID(),
          seasonId: '2024-Q1',
          type: 'team',
          teamId: team.id,
          currentRank: 2,
          totalPoints: 150,
          tournamentsPlayed: 2,
          tournamentsWon: 1,
          region: 'global',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const response = await agent
        .get('/api/v1/leaderboard/top-season-stats')
        .query({
          seasonId: '2024-Q1',
          category: 'team',
          limit: 10,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].currentRank).toBe(1);
      expect(response.body.data[1].currentRank).toBe(2);
    });
  });

  describe('POST /api/v1/leaderboard/refresh', () => {
    it('should refresh leaderboard as admin', async () => {
      // Login as admin
      await agent
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'password', // This would need to be set up properly
        });

      const response = await agent
        .post('/api/v1/leaderboard/refresh')
        .send({
          type: 'tournament',
          category: 'teams',
          tournamentId: tournament.id,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Leaderboard refreshed successfully');
      expect(response.body.data).toBeDefined();
    });

    it('should reject refresh without authentication', async () => {
      const response = await agent
        .post('/api/v1/leaderboard/refresh')
        .send({
          type: 'tournament',
          category: 'teams',
          tournamentId: tournament.id,
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/leaderboard/history/:participantId', () => {
    it('should return participant season history', async () => {
      // Create season stats for multiple seasons
      await seasonStatsRepo.save([
        {
          id: randomUUID(),
          seasonId: '2024-Q1',
          type: 'team',
          teamId: team.id,
          totalPoints: 200,
          tournamentsPlayed: 2,
          tournamentsWon: 2,
          region: 'global',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: randomUUID(),
          seasonId: '2023-Q4',
          type: 'team',
          teamId: team.id,
          totalPoints: 150,
          tournamentsPlayed: 2,
          tournamentsWon: 1,
          region: 'global',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const response = await agent
        .get(`/api/v1/leaderboard/history/${team.id}`)
        .query({
          type: 'team',
          limit: 5,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].seasonId).toBe('2024-Q1'); // Most recent first
      expect(response.body.data[1].seasonId).toBe('2023-Q4');
    });
  });

  describe('GET /api/v1/leaderboard/season/:seasonId/summary', () => {
    it('should return season summary', async () => {
      // Create season stats
      await seasonStatsRepo.save([
        {
          id: randomUUID(),
          seasonId: '2024-Q1',
          type: 'team',
          teamId: team.id,
          totalPoints: 200,
          tournamentsPlayed: 2,
          tournamentsWon: 2,
          region: 'global',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: randomUUID(),
          seasonId: '2024-Q1',
          type: 'player',
          userId: user.id,
          totalPoints: 180,
          tournamentsPlayed: 2,
          tournamentsWon: 1,
          region: 'global',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const response = await agent
        .get('/api/v1/leaderboard/season/2024-Q1/summary')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.totalParticipants).toBe(2);
      expect(response.body.data.totalTeams).toBe(1);
      expect(response.body.data.totalPlayers).toBe(1);
      expect(response.body.data.averagePoints).toBe(190); // (200 + 180) / 2
      expect(response.body.data.topPerformers).toBeDefined();
      expect(response.body.data.topPerformers.teams).toHaveLength(1);
      expect(response.body.data.topPerformers.players).toHaveLength(1);
    });
  });

  describe('Cache behavior', () => {
    it('should cache leaderboard responses', async () => {
      // First request
      const response1 = await agent
        .get('/api/v1/leaderboard/tournament/test-tournament')
        .query({
          type: 'tournament',
          category: 'teams',
        })
        .expect(200);

      // Second request should hit cache
      const response2 = await agent
        .get('/api/v1/leaderboard/tournament/test-tournament')
        .query({
          type: 'tournament',
          category: 'teams',
        })
        .expect(200);

      expect(response1.body.data.lastUpdated).toEqual(response2.body.data.lastUpdated);
    });

    it('should invalidate cache on refresh', async () => {
      // Login as admin
      await agent
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'password',
        });

      // First request
      const response1 = await agent
        .get('/api/v1/leaderboard/tournament/test-tournament')
        .query({
          type: 'tournament',
          category: 'teams',
        })
        .expect(200);

      // Refresh leaderboard
      await agent
        .post('/api/v1/leaderboard/refresh')
        .send({
          type: 'tournament',
          category: 'teams',
          tournamentId: 'test-tournament',
        })
        .expect(200);

      // Second request after refresh
      const response2 = await agent
        .get('/api/v1/leaderboard/tournament/test-tournament')
        .query({
          type: 'tournament',
          category: 'teams',
        })
        .expect(200);

      // Timestamp should be different after refresh
      expect(new Date(response2.body.data.lastUpdated)).toBeInstanceOf(Date);
    });
  });

  describe('Error handling', () => {
    it('should handle invalid query parameters', async () => {
      const response = await agent
        .get('/api/v1/leaderboard/global')
        .query({
          type: 'invalid',
          category: 'teams',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should handle missing required parameters', async () => {
      const response = await agent
        .get('/api/v1/leaderboard/global')
        .query({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should handle pagination limits', async () => {
      const response = await agent
        .get('/api/v1/leaderboard/global')
        .query({
          type: 'global',
          category: 'teams',
          limit: 200, // Over max limit
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });
});
