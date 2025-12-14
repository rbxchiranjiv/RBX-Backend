import { Test, TestingModule } from '@nestjs/testing';
import { Repository, DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SeasonAggregationService } from '../season-aggregation.service';
import {
  SeasonStatsEntity,
  StandingEntity,
  StandingType,
  TournamentEntity,
  TeamEntity,
  UserEntity,
  MatchEntity,
  RegistrationEntity,
} from '../../database/entities';

describe.skip('SeasonAggregationService', () => {
  let service: SeasonAggregationService;
  let seasonStatsRepo: jest.Mocked<Repository<SeasonStatsEntity>>;
  let standingRepo: jest.Mocked<Repository<StandingEntity>>;
  let tournamentRepo: jest.Mocked<Repository<TournamentEntity>>;
  let matchRepo: jest.Mocked<Repository<MatchEntity>>;
  let teamRepo: jest.Mocked<Repository<TeamEntity>>;
  let userRepo: jest.Mocked<Repository<UserEntity>>;
  let registrationRepo: jest.Mocked<Repository<RegistrationEntity>>;
  let dataSource: jest.Mocked<DataSource>;

  const mockTournament = {
    id: 'tournament-1',
    name: 'Test Tournament',
    mode: 'BR',
  } as TournamentEntity;

  const mockStanding = {
    id: 'standing-1',
    tournamentId: 'tournament-1',
    teamId: 'team-1',
    userId: 'user-1',
    rank: 1,
    points: 100,
    matchesPlayed: 5,
    wins: 4,
    losses: 1,
    draws: 0,
    kills: 50,
    deaths: 20,
    assists: 15,
    survivalTime: 9000,
    kdratio: 2.5,
    avgPlacement: 1.8,
    roundsWon: 0,
    roundsLost: 0,
    adr: 0,
    hsPercentage: 0,
    team: { id: 'team-1', name: 'Team Alpha' },
    user: { id: 'user-1', displayName: 'Player One' },
  } as StandingEntity;

  const mockSeasonStats = {
    id: 'stats-1',
    seasonId: '2024-Q1',
    type: 'team',
    teamId: 'team-1',
    tournamentsPlayed: 10,
    tournamentsWon: 3,
    totalPoints: 500,
    avgPlacement: 2.5,
    currentRank: 5,
    peakRank: 3,
    winRate: 30.0,
    totalMatches: 50,
    totalWins: 15,
    totalLosses: 35,
    totalDraws: 0,
    totalKills: 250,
    totalDeaths: 200,
    totalAssists: 75,
    totalSurvivalTime: 45000,
    avgKills: 5.0,
    kdratio: 1.25,
    weeklyStats: {} as any,
    achievements: {
      firstPlace: 3,
      top3: 8,
      top5: 12,
      top10: 20,
      perfectGames: 1,
      longestWinStreak: 4,
      currentWinStreak: 0,
    },
    metadata: {},
  } as SeasonStatsEntity;

  beforeEach(async () => {
    seasonStatsRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as any;

    standingRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    } as any;

    tournamentRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
    } as any;

    matchRepo = {
      find: jest.fn(),
      count: jest.fn(),
    } as any;

    teamRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    } as any;

    userRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    } as any;

    registrationRepo = {
      find: jest.fn(),
      save: jest.fn(),
    } as any;

    dataSource = {
      transaction: jest.fn(),
    } as any;

    service = new SeasonAggregationService(
      seasonStatsRepo,
      standingRepo,
      tournamentRepo,
      matchRepo,
      teamRepo,
      userRepo,
      registrationRepo,
      dataSource,
    );
  });

  describe('updateSeasonStats', () => {
    it('should update season stats for tournament standings', async () => {
      tournamentRepo.findOne.mockResolvedValue(mockTournament);
      standingRepo.find.mockResolvedValue([mockStanding]);

      // Mock existing season stats
      seasonStatsRepo.findOne.mockResolvedValue(mockSeasonStats);
      seasonStatsRepo.save.mockResolvedValue(mockSeasonStats);

      dataSource.transaction.mockImplementation(async (callback: any) => {
        const mockManager = {
          findOne: jest.fn().mockResolvedValue(mockSeasonStats),
          save: jest.fn().mockResolvedValue(mockSeasonStats),
        } as any;
        await callback(mockManager);
      });

      await service.updateSeasonStats('tournament-1');

      expect(tournamentRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'tournament-1' },
      });
      expect(standingRepo.find).toHaveBeenCalledWith({
        where: {
          tournamentId: 'tournament-1',
          type: StandingType.TOURNAMENT,
          status: 'final',
        },
        relations: ['team', 'user'],
      });
      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it('should create new season stats if none exist', async () => {
      tournamentRepo.findOne.mockResolvedValue(mockTournament);
      standingRepo.find.mockResolvedValue([mockStanding]);

      // Mock no existing season stats
      seasonStatsRepo.findOne.mockResolvedValue(null);
      seasonStatsRepo.create.mockReturnValue({
        seasonId: '2024-Q1',
        type: 'team',
        teamId: 'team-1',
        tournamentsPlayed: 0,
        tournamentsWon: 0,
        totalPoints: 0,
        avgPlacement: 0,
        currentRank: 0,
        peakRank: 0,
        winRate: 0,
        totalMatches: 0,
        totalWins: 0,
        totalLosses: 0,
        totalDraws: 0,
        totalKills: 0,
        totalDeaths: 0,
        totalAssists: 0,
        totalSurvivalTime: 0,
        avgKills: 0,
        kdratio: 0,
        totalRoundsWon: 0,
        totalRoundsLost: 0,
        totalADR: 0,
        avgADR: 0,
        totalHSPercentage: 0,
        avgHSPercentage: 0,
        weeklyStats: {} as any,
        achievements: service['getDefaultAchievements'](),
        metadata: {},
      } as unknown as SeasonStatsEntity);
      seasonStatsRepo.save.mockResolvedValue(mockSeasonStats);

      let mockManager: any;
      
      dataSource.transaction.mockImplementation(async (callback: any) => {
        mockManager = {
          findOne: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockReturnValue(mockSeasonStats),
          save: jest.fn().mockResolvedValue(mockSeasonStats),
        } as any;
        await callback(mockManager);
      });

      await service.updateSeasonStats('tournament-1');

      expect(mockManager.create).toHaveBeenCalled();
      expect(mockManager.save).toHaveBeenCalled();
    });

    it('should throw error if tournament not found', async () => {
      tournamentRepo.findOne.mockResolvedValue(null);

      await expect(service.updateSeasonStats('invalid-id')).rejects.toThrow(
        'Tournament invalid-id not found',
      );
    });
  });

  describe('getSeasonStats', () => {
    it('should return season stats for a team', async () => {
      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockSeasonStats),
      } as any;

      seasonStatsRepo.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.getSeasonStats('team-1', 'team', '2024-Q1');

      expect(queryBuilder.where).toHaveBeenCalledWith('stats.teamId = :participantId', { participantId: 'team-1' });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('stats.type = :type', { type: 'team' });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('stats.seasonId = :seasonId', { seasonId: '2024-Q1' });

      expect(result).toEqual(mockSeasonStats);
    });

    it('should return season stats for a player', async () => {
      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockSeasonStats),
      } as any;

      seasonStatsRepo.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.getSeasonStats('user-1', 'player');

      expect(queryBuilder.where).toHaveBeenCalledWith('stats.userId = :participantId', { participantId: 'user-1' });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('stats.type = :type', { type: 'player' });

      expect(result).toEqual(mockSeasonStats);
    });
  });

  describe('getTopSeasonStats', () => {
    it('should return top season stats for teams', async () => {
      const mockTopStats = [mockSeasonStats, { ...mockSeasonStats, id: 'stats-2', currentRank: 2 }];

      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockTopStats),
      } as any;

      seasonStatsRepo.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.getTopSeasonStats('2024-Q1', {
        limit: 10,
        region: 'global',
        category: 'team',
      });

      expect(queryBuilder.where).toHaveBeenCalledWith('stats.seasonId = :seasonId', { seasonId: '2024-Q1' });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('stats.region = :region', { region: 'global' });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('stats.teamId IS NOT NULL');
      expect(queryBuilder.orderBy).toHaveBeenCalledWith('stats.currentRank', 'ASC');
      expect(queryBuilder.limit).toHaveBeenCalledWith(10);

      expect(result).toEqual(mockTopStats);
    });

    it('should return top season stats for players', async () => {
      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockSeasonStats]),
      } as any;

      seasonStatsRepo.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.getTopSeasonStats('2024-Q1', {
        category: 'player',
      });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('stats.userId IS NOT NULL');

      expect(result).toEqual([mockSeasonStats]);
    });
  });

  describe('getSeasonHistory', () => {
    it('should return season history for participant', async () => {
      const mockHistory = [
        mockSeasonStats,
        { ...mockSeasonStats, id: 'stats-2', seasonId: '2023-Q4' },
      ];

      seasonStatsRepo.find.mockResolvedValue(mockHistory);

      const result = await service.getSeasonHistory('team-1', 'team', 5);

      expect(seasonStatsRepo.find).toHaveBeenCalledWith({
        where: {
          teamId: 'team-1',
          type: 'team',
        },
        order: { createdAt: 'DESC' },
        take: 5,
        relations: ['team', 'user'],
      });

      expect(result).toEqual(mockHistory);
    });
  });

  describe('calculateSeasonRankings', () => {
    it('should calculate rankings for season stats', async () => {
      const mockStats = [
        { ...mockSeasonStats, totalPoints: 500, winRate: 60.0, avgPlacement: 1.5 },
        { ...mockSeasonStats, id: 'stats-2', totalPoints: 400, winRate: 50.0, avgPlacement: 2.0 },
        { ...mockSeasonStats, id: 'stats-3', totalPoints: 300, winRate: 40.0, avgPlacement: 3.0 },
      ];

      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockStats),
      } as any;

      seasonStatsRepo.createQueryBuilder.mockReturnValue(queryBuilder);

      dataSource.transaction.mockImplementation(async (callback: any) => {
        const mockManager = {
          save: jest.fn().mockResolvedValue({}),
        } as any;
        await callback(mockManager);
      });

      await service.calculateSeasonRankings('2024-Q1', { region: 'global', category: 'team' });

      expect(queryBuilder.where).toHaveBeenCalledWith('stats.seasonId = :seasonId', { seasonId: '2024-Q1' });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('stats.region = :region', { region: 'global' });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('stats.teamId IS NOT NULL');

      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it('should handle ties in rankings', async () => {
      const mockStats = [
        { ...mockSeasonStats, totalPoints: 500, winRate: 60.0, avgPlacement: 1.5 },
        { ...mockSeasonStats, id: 'stats-2', totalPoints: 500, winRate: 60.0, avgPlacement: 1.5 }, // Tie
        { ...mockSeasonStats, id: 'stats-3', totalPoints: 400, winRate: 50.0, avgPlacement: 2.0 },
      ];

      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockStats),
      } as any;

      seasonStatsRepo.createQueryBuilder.mockReturnValue(queryBuilder);

      dataSource.transaction.mockImplementation(async (callback: any) => {
        const mockManager = {
          save: jest.fn().mockImplementation((entity) => {
            // Verify that tied participants get the same rank
            if (entity.id === 'stats-2') {
              expect(entity.currentRank).toBe(1); // Same rank as stats-1
            }
            return entity;
          }),
        } as any;
        await callback(mockManager);
      });

      await service.calculateSeasonRankings('2024-Q1');

      expect(dataSource.transaction).toHaveBeenCalled();
    });
  });

  describe('getSeasonSummary', () => {
    it('should return season summary statistics', async () => {
      const mockTeamStats = [mockSeasonStats];
      const mockPlayerStats = [{ ...mockSeasonStats, id: 'stats-2', type: 'player' as const, userId: 'user-1' }];

      seasonStatsRepo.find
        .mockResolvedValueOnce(mockTeamStats)
        .mockResolvedValueOnce(mockPlayerStats);

      tournamentRepo.count.mockResolvedValue(5);
      matchRepo.count.mockResolvedValue(50);

      const result = await service.getSeasonSummary('2024-Q1', 'global');

      expect(tournamentRepo.count).toHaveBeenCalled();
      expect(matchRepo.count).toHaveBeenCalled();

      expect(result).toEqual({
        totalParticipants: 2,
        totalTeams: 1,
        totalPlayers: 1,
        totalTournaments: 5,
        totalMatches: 50,
        averagePoints: 250, // (500 + 0) / 2
        topPerformers: {
          teams: mockTeamStats,
          players: mockPlayerStats,
        },
      });
    });
  });

  describe('helper methods', () => {
    it('should get current season correctly', () => {
      const currentSeason = service['getCurrentSeason']();
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const quarter = Math.floor(month / 3) + 1;
      const expectedSeason = `${year}-Q${quarter}`;

      expect(currentSeason).toBe(expectedSeason);
    });

    it('should get week number correctly', () => {
      const testDate = new Date('2024-01-07'); // First Sunday of 2024 (week 2)
      const weekNumber = service['getWeekNumber'](testDate);
      expect(weekNumber).toBe(2);
    });

    it('should get current week correctly', () => {
      const currentWeek = service['getCurrentWeek']();
      const now = new Date();
      const year = now.getFullYear();
      const weekNumber = service['getWeekNumber'](now);
      const expectedWeek = `${year}-W${weekNumber}`;

      expect(currentWeek).toBe(expectedWeek);
    });

    it('should get default achievements', () => {
      const achievements = service['getDefaultAchievements']();

      expect(achievements).toEqual({
        firstPlace: 0,
        top3: 0,
        top5: 0,
        top10: 0,
        perfectGames: 0,
        longestWinStreak: 0,
        currentWinStreak: 0,
        firstTournament: false,
        tenTournaments: false,
        hundredTournaments: false,
      });
    });
  });

  describe('updateWeeklyStats', () => {
    it('should update weekly stats correctly', () => {
      const seasonStats = { ...mockSeasonStats, weeklyStats: {} } as any;
      const standing = { ...mockStanding, rank: 2, points: 80, wins: 1, losses: 1 } as any;

      service['updateWeeklyStats'](seasonStats, standing);

      const currentWeek = service['getCurrentWeek']();
      expect(seasonStats.weeklyStats[currentWeek]).toBeDefined();
      expect(seasonStats.weeklyStats[currentWeek].points).toBe(80);
      expect(seasonStats.weeklyStats[currentWeek].rank).toBe(2);
      expect(seasonStats.weeklyStats[currentWeek].tournaments).toBe(1);
      expect(seasonStats.weeklyStats[currentWeek].wins).toBe(1);
      expect(seasonStats.weeklyStats[currentWeek].losses).toBe(1);
    });

    it('should accumulate weekly stats for multiple tournaments', () => {
      const seasonStats = {
        ...mockSeasonStats,
        weeklyStats: {
          [service['getCurrentWeek']()]: {
            points: 50,
            rank: 3,
            tournaments: 1,
            wins: 0,
            losses: 1,
          },
        },
      } as any;
      const standing = { ...mockStanding, rank: 1, points: 100, wins: 1, losses: 0 } as any;

      service['updateWeeklyStats'](seasonStats, standing);

      const currentWeek = service['getCurrentWeek']();
      expect(seasonStats.weeklyStats[currentWeek].points).toBe(150); // 50 + 100
      expect(seasonStats.weeklyStats[currentWeek].rank).toBe(1); // Latest rank
      expect(seasonStats.weeklyStats[currentWeek].tournaments).toBe(2); // 1 + 1
      expect(seasonStats.weeklyStats[currentWeek].wins).toBe(1); // 0 + 1
      expect(seasonStats.weeklyStats[currentWeek].losses).toBe(1); // 1 + 0
    });
  });

  describe('updateAchievements', () => {
    it('should update achievements for first place', () => {
      const achievements = service['getDefaultAchievements']();
      const standing = { ...mockStanding, rank: 1 } as any;

      service['updateAchievements']({ ...mockSeasonStats, achievements }, standing);

      expect(achievements.firstPlace).toBe(1);
      expect(achievements.currentWinStreak).toBe(1);
      expect(achievements.longestWinStreak).toBe(1);
    });

    it('should update achievements for top placements', () => {
      const achievements = service['getDefaultAchievements']();
      const standing = { ...mockStanding, rank: 2 } as any;

      service['updateAchievements']({ ...mockSeasonStats, achievements }, standing);

      expect(achievements.firstPlace).toBe(0);
      expect(achievements.top3).toBe(1);
      expect(achievements.top5).toBe(1);
      expect(achievements.top10).toBe(1);
      expect(achievements.currentWinStreak).toBe(0);
    });

    it('should track win streaks correctly', () => {
      const achievements = { ...service['getDefaultAchievements'](), longestWinStreak: 3, currentWinStreak: 2 } as any;
      
      // Win
      service['updateAchievements']({ ...mockSeasonStats, achievements }, { ...mockStanding, rank: 1 });
      expect(achievements.currentWinStreak).toBe(3);
      expect(achievements.longestWinStreak).toBe(3);

      // Loss
      service['updateAchievements']({ ...mockSeasonStats, achievements }, { ...mockStanding, rank: 5 });
      expect(achievements.currentWinStreak).toBe(0);
      expect(achievements.longestWinStreak).toBe(3);
    });

    it('should track perfect games', () => {
      const achievements = service['getDefaultAchievements']();
      const standing = { ...mockStanding, rank: 1, deaths: 0 } as any;

      service['updateAchievements']({ ...mockSeasonStats, achievements }, standing);

      expect(achievements.perfectGames).toBe(1);
    });
  });
});
