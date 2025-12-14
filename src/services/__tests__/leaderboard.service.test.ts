import { Test, TestingModule } from '@nestjs/testing';
import { Repository, DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LeaderboardService, LeaderboardQueryOptions, LeaderboardResult } from '../leaderboard.service';
import { cacheWrap, cacheInvalidate } from '../cache.service';
import {
  LeaderboardSnapshotEntity,
  LeaderboardType,
  LeaderboardCategory,
  StandingEntity,
  StandingType,
  TournamentEntity,
  TeamEntity,
  UserEntity,
} from '../../database/entities';

jest.mock('../cache.service');

describe('LeaderboardService', () => {
  let service: LeaderboardService;
  let leaderboardSnapshotRepo: jest.Mocked<Repository<LeaderboardSnapshotEntity>>;
  let standingRepo: jest.Mocked<Repository<StandingEntity>>;
  let tournamentRepo: jest.Mocked<Repository<TournamentEntity>>;
  let teamRepo: jest.Mocked<Repository<TeamEntity>>;
  let userRepo: jest.Mocked<Repository<UserEntity>>;
  let dataSource: jest.Mocked<DataSource>;

  const mockSnapshot = {
    id: 'snapshot-1',
    type: LeaderboardType.TOURNAMENT,
    category: LeaderboardCategory.TEAMS,
    seasonId: '2024-Q1',
    tournamentId: 'tournament-1',
    region: 'global',
    data: {
      entries: [
        {
          id: 'team-1',
          name: 'Team Alpha',
          rank: 1,
          points: 100,
          stats: { wins: 5, losses: 0 },
        },
        {
          id: 'team-2',
          name: 'Team Beta',
          rank: 2,
          points: 80,
          stats: { wins: 4, losses: 1 },
        },
      ],
      totalEntries: 2,
      lastUpdated: new Date().toISOString(),
    },
    snapshotKey: 'tournament:teams:2024-Q1:tournament-1:global:points:desc',
    maxEntries: 100,
    filters: {},
    sortBy: 'points',
    sortOrder: 'desc',
    createdAt: new Date(),
  } as LeaderboardSnapshotEntity;

  beforeEach(async () => {
    leaderboardSnapshotRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    } as any;

    standingRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as any;

    tournamentRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    } as any;

    teamRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    } as any;

    userRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    } as any;

    dataSource = {
      getRepository: jest.fn(),
    } as any;

    service = new LeaderboardService(
      leaderboardSnapshotRepo,
      standingRepo,
      tournamentRepo,
      teamRepo,
      userRepo,
      dataSource,
    );

    // Reset cache mocks
    jest.clearAllMocks();
    (cacheWrap as jest.Mock).mockClear();
    (cacheInvalidate as jest.Mock).mockClear();
  });

  describe('getLeaderboard', () => {
    it('should return cached leaderboard when available', async () => {
      const options: LeaderboardQueryOptions = {
        type: LeaderboardType.TOURNAMENT,
        category: LeaderboardCategory.TEAMS,
        tournamentId: 'tournament-1',
      } as any;

      const expectedResult: LeaderboardResult = {
        entries: mockSnapshot.data.entries,
        totalEntries: mockSnapshot.data.totalEntries,
        lastUpdated: mockSnapshot.createdAt,
        snapshotKey: mockSnapshot.snapshotKey,
        hasNext: false,
        hasPrevious: false,
      } as any;

      (cacheWrap as jest.Mock).mockResolvedValue(expectedResult);

      const result = await service.getLeaderboard(options);

      expect(cacheWrap).toHaveBeenCalledWith(
        expect.stringContaining('leaderboard'),
        10,
        expect.any(Function),
      );
      expect(result).toEqual(expectedResult);
    });

    it('should generate new leaderboard when no valid snapshot exists', async () => {
      const options: LeaderboardQueryOptions = {
        type: LeaderboardType.TOURNAMENT,
        category: LeaderboardCategory.TEAMS,
        tournamentId: 'tournament-1',
      } as any;

      const mockStandings = [
        {
          id: 'standing-1',
          tournamentId: 'tournament-1',
          teamId: 'team-1',
          rank: 1,
          points: 100,
          matchesPlayed: 5,
          wins: 4,
          losses: 1,
          draws: 0,
          kills: 50,
          deaths: 25,
          assists: 30,
          kdratio: 2.0,
          avgPlacement: 1.2,
          team: { id: 'team-1', name: 'Team Alpha' },
        },
        {
          id: 'standing-2',
          tournamentId: 'tournament-1',
          teamId: 'team-2',
          rank: 2,
          points: 80,
          matchesPlayed: 5,
          wins: 3,
          losses: 2,
          draws: 0,
          kills: 40,
          deaths: 30,
          assists: 25,
          kdratio: 1.33,
          avgPlacement: 2.1,
          team: { id: 'team-2', name: 'Team Beta' },
        },
      ] as unknown as StandingEntity[];

      // Mock cacheWrap to call the producer function
      (cacheWrap as jest.Mock).mockImplementation(async (key, ttl, producer) => {
        return producer();
      });

      // Mock no valid snapshot
      leaderboardSnapshotRepo.findOne.mockResolvedValue(null);

      // Mock standings query
      standingRepo.find.mockResolvedValue(mockStandings);

      // Mock snapshot creation
      leaderboardSnapshotRepo.create.mockReturnValue(mockSnapshot);
      leaderboardSnapshotRepo.save.mockResolvedValue(mockSnapshot);

      const result = await service.getLeaderboard(options);

      expect(result).toBeDefined();
      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].name).toBe('Team Alpha');
      expect(result.entries[0].rank).toBe(1);
      expect(result.entries[0].points).toBe(100);
    });
  });

  describe('sortEntries', () => {
    it('should sort entries by points descending', () => {
      const entries = [
        { id: '1', name: 'Team A', rank: 0, points: 80, stats: {} },
        { id: '2', name: 'Team B', rank: 0, points: 100, stats: {} },
        { id: '3', name: 'Team C', rank: 0, points: 90, stats: {} },
      ];

      const serviceAny = service as any;
      const sorted = serviceAny.sortEntries(entries, 'points', 'desc');

      expect(sorted[0].points).toBe(100);
      expect(sorted[1].points).toBe(90);
      expect(sorted[2].points).toBe(80);
    });
  });

  describe('invalidateCache', () => {
    it('should invalidate cache with pattern', async () => {
      await service.invalidateCache('tournament:*');

      expect(cacheInvalidate).toHaveBeenCalledWith('tournament:*');
    });
  });
});
