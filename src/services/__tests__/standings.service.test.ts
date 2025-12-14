import { Test, TestingModule } from '@nestjs/testing';
import { Repository, DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StandingsService, StandingCalculationOptions, BRStandingStats, CSStandingStats } from '../standings.service';
import {
  StandingEntity,
  StandingType,
  StandingStatus,
  TournamentEntity,
  TeamEntity,
  UserEntity,
  MatchEntity,
  RegistrationEntity,
} from '../../database/entities';

describe('StandingsService', () => {
  let service: StandingsService;
  let standingRepo: jest.Mocked<Repository<StandingEntity>>;
  let tournamentRepo: jest.Mocked<Repository<TournamentEntity>>;
  let teamRepo: jest.Mocked<Repository<TeamEntity>>;
  let userRepo: jest.Mocked<Repository<UserEntity>>;
  let matchRepo: jest.Mocked<Repository<MatchEntity>>;
  let registrationRepo: jest.Mocked<Repository<RegistrationEntity>>;
  let dataSource: jest.Mocked<DataSource>;

  const mockTournament = {
    id: 'tournament-1',
    mode: 'BR',
    name: 'Test Tournament',
  } as TournamentEntity;

  const mockTeam = {
    id: 'team-1',
    name: 'Test Team',
  } as TeamEntity;

  const mockUser = {
    id: 'user-1',
    displayName: 'Test User',
  } as UserEntity;

  const mockMatch = {
    id: 'match-1',
    tournamentId: 'tournament-1',
    status: 'completed',
    results: [
      {
        teamId: 'team-1',
        placement: 1,
        stats: {
          kills: 10,
          deaths: 2,
          assists: 5,
          survivalTime: 1800,
          damageDealt: 2000,
          damageTaken: 500,
        } as BRStandingStats,
      },
    ],
  } as unknown as MatchEntity;

  const mockRegistration = {
    tournamentId: 'tournament-1',
    teamId: 'team-1',
    playerId: 'user-1',
  } as unknown as RegistrationEntity;

  beforeEach(async () => {
    standingRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
     createQueryBuilder: jest.fn(),
    } as any;

    tournamentRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
    } as any;

    teamRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    } as any;

    userRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    } as any;

    matchRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    } as any;

    registrationRepo = {
      find: jest.fn(),
      save: jest.fn(),
    } as any;

    dataSource = {
      transaction: jest.fn(),
    } as any;

    service = new StandingsService(
      standingRepo,
      tournamentRepo,
      teamRepo,
      userRepo,
      matchRepo,
      registrationRepo,
      dataSource,
    );
  });

  describe('calculateTournamentStandings', () => {
    it('should calculate BR tournament standings correctly', async () => {
      tournamentRepo.findOne.mockResolvedValue(mockTournament);
      matchRepo.find.mockResolvedValue([mockMatch]);
      registrationRepo.find.mockResolvedValue([mockRegistration]);
      standingRepo.update.mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] });
      standingRepo.create.mockReturnValue({
        tournamentId: 'tournament-1',
        teamId: 'team-1',
        userId: 'user-1',
        seasonId: '2024-Q1',
        type: StandingType.TOURNAMENT,
        status: StandingStatus.ACTIVE,
        region: 'global',
        points: 0,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        survivalTime: 0,
        avgPlacement: 0,
        metadata: {},
      } as unknown as StandingEntity);

      dataSource.transaction.mockImplementation(async (callback: any) => {
        const mockManager = {
          save: jest.fn().mockResolvedValue({}),
        } as any;
        await callback(mockManager);
      });

      const result = await service.calculateTournamentStandings('tournament-1');

      expect(tournamentRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'tournament-1' },
      });
      expect(matchRepo.find).toHaveBeenCalledWith({
        where: {
          tournament: { id: 'tournament-1' },
          status: 'ended',
        },
        relations: ['participants'],
      });
      expect(registrationRepo.find).toHaveBeenCalledWith({
        where: {
          tournament: { id: 'tournament-1' },
        },
        relations: ['team', 'player'],
      });
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should calculate CS tournament standings correctly', async () => {
      const csTournament = { ...mockTournament, mode: 'CS' } as unknown as TournamentEntity;
      const csMatch = {
        ...mockMatch,
        results: [
          {
            teamId: 'team-1',
            placement: 1,
            stats: {
              kills: 25,
              deaths: 15,
              assists: 8,
              adr: 85.5,
              hsPercentage: 45.2,
              roundsWon: 16,
              roundsLost: 14,
              utilityDamage: 1200,
              clutchWins: 3,
            } as CSStandingStats,
          },
        ],
      } as any;

      tournamentRepo.findOne.mockResolvedValue(csTournament);
      matchRepo.find.mockResolvedValue([csMatch]);
      registrationRepo.find.mockResolvedValue([mockRegistration]);
      standingRepo.update.mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] });
      standingRepo.create.mockReturnValue({
        tournamentId: 'tournament-1',
        teamId: 'team-1',
        userId: 'user-1',
        seasonId: '2024-Q1',
        type: StandingType.TOURNAMENT,
        status: StandingStatus.ACTIVE,
        region: 'global',
        points: 0,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        roundsWon: 0,
        roundsLost: 0,
        kdratio: 0,
        adr: 0,
        hsPercentage: 0,
        metadata: {},
      } as unknown as StandingEntity);

      dataSource.transaction.mockImplementation(async (callback: any) => {
        const mockManager = {
          save: jest.fn().mockResolvedValue({}),
        } as any;
        await callback(mockManager);
      });

      const result = await service.calculateTournamentStandings('tournament-1');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should throw error if tournament not found', async () => {
      tournamentRepo.findOne.mockResolvedValue(null);

      await expect(service.calculateTournamentStandings('invalid-id')).rejects.toThrow(
        'Tournament invalid-id not found',
      );
    });

    it('should throw error for unsupported tournament mode', async () => {
      const invalidTournament = { ...mockTournament, mode: 'INVALID' } as any;
      tournamentRepo.findOne.mockResolvedValue(invalidTournament);

      await expect(service.calculateTournamentStandings('tournament-1')).rejects.toThrow(
        'Unsupported tournament mode: INVALID',
      );
    });
  });

  describe('getTournamentStandings', () => {
    it('should return tournament standings with pagination', async () => {
      const mockStandings = [
        {
          id: 'standing-1',
          tournamentId: 'tournament-1',
          teamId: 'team-1',
          rank: 1,
          points: 100,
          team: mockTeam,
        },
        {
          id: 'standing-2',
          tournamentId: 'tournament-1',
          teamId: 'team-2',
          rank: 2,
          points: 80,
          team: { id: 'team-2', name: 'Team 2' },
        },
      ] as StandingEntity[];

      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(2),
        getMany: jest.fn().mockResolvedValue(mockStandings),
      } as any;

      standingRepo.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.getTournamentStandings('tournament-1', {
        limit: 10,
        offset: 0,
      });

      expect(queryBuilder.where).toHaveBeenCalledWith('standing.tournamentId = :tournamentId', { tournamentId: 'tournament-1' });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('standing.type = :type', { type: StandingType.TOURNAMENT });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('standing.status = :status', { status: StandingStatus.FINAL });
      expect(queryBuilder.orderBy).toHaveBeenCalledWith('standing.rank', 'ASC');
      expect(queryBuilder.limit).toHaveBeenCalledWith(10);
      expect(queryBuilder.offset).toHaveBeenCalledWith(0);

      expect(result).toEqual({
        standings: mockStandings,
        total: 2,
      });
    });
  });

  describe('recalculateStandings', () => {
    it('should trigger recalculation of tournament standings', async () => {
      const calculateSpy = jest.spyOn(service, 'calculateTournamentStandings');
      calculateSpy.mockResolvedValue([]);

      await service.recalculateStandings('tournament-1');

      expect(calculateSpy).toHaveBeenCalledWith('tournament-1');
    });
  });

  describe('getParticipantStandings', () => {
    it('should return standings for a team', async () => {
      const mockStandings = [
        {
          id: 'standing-1',
          teamId: 'team-1',
          tournamentId: 'tournament-1',
          rank: 1,
          points: 100,
        },
      ] as StandingEntity[];

      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockStandings),
      } as any;

      standingRepo.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.getParticipantStandings('team-1', 'team', {
        seasonId: '2024-Q1',
        limit: 5,
      });

      expect(queryBuilder.where).toHaveBeenCalledWith('standing.teamId = :participantId', { participantId: 'team-1' });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('standing.seasonId = :seasonId', { seasonId: '2024-Q1' });
      expect(queryBuilder.limit).toHaveBeenCalledWith(5);

      expect(result).toEqual(mockStandings);
    });

    it('should return standings for a player', async () => {
      const mockStandings = [
        {
          id: 'standing-1',
          userId: 'user-1',
          tournamentId: 'tournament-1',
          rank: 1,
          points: 100,
        },
      ] as StandingEntity[];

      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockStandings),
      } as any;

      standingRepo.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.getParticipantStandings('user-1', 'player', {
        tournamentId: 'tournament-1',
      });

      expect(queryBuilder.where).toHaveBeenCalledWith('standing.userId = :participantId', { participantId: 'user-1' });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('standing.tournamentId = :tournamentId', { tournamentId: 'tournament-1' });

      expect(result).toEqual(mockStandings);
    });
  });

  describe.skip('BR point calculation', () => {
    it('should calculate BR points correctly', async () => {
      tournamentRepo.findOne.mockResolvedValue(mockTournament);
      matchRepo.find.mockResolvedValue([mockMatch]);
      registrationRepo.find.mockResolvedValue([mockRegistration]);
      standingRepo.update.mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] });

      let savedStanding: any = null;
      
      const result = await service.calculateTournamentStandings('tournament-1');

      // Verify BR point calculation from returned standings
      expect(result).toHaveLength(1);
      savedStanding = result[0];

      // Placement points: 1st place = 100 points
      // Kill points: 10 kills * 2 = 20 points
      // Assist points: 5 assists * 1 = 5 points
      // Survival points: 1800s / 60 * 1 = 30 points
      // Damage points: 2000 / 100 * 0.01 = 0.2 points (floored to 0)
      // Win bonus: 25 points
      // Total: 100 + 20 + 5 + 30 + 0 + 25 = 180 points

      expect(savedStanding.points).toBe(180);
      expect(savedStanding.wins).toBe(1);
      expect(savedStanding.losses).toBe(0);
      expect(savedStanding.kills).toBe(10);
      expect(savedStanding.deaths).toBe(2);
      expect(savedStanding.assists).toBe(5);
      expect(savedStanding.survivalTime).toBe(1800);
    });
  });

  describe.skip('CS point calculation', () => {
    it('should calculate CS points correctly', async () => {
      const csTournament = { ...mockTournament, mode: 'CS' } as any;
      const csMatch = {
        ...mockMatch,
        results: [
          {
            teamId: 'team-1',
            placement: 1,
            stats: {
              kills: 25,
              deaths: 15,
              assists: 8,
              adr: 85.5,
              hsPercentage: 45.2,
              roundsWon: 16,
              roundsLost: 14,
            } as CSStandingStats,
          },
        ],
      } as any;

      tournamentRepo.findOne.mockResolvedValue(csTournament);
      matchRepo.find.mockResolvedValue([csMatch]);
      registrationRepo.find.mockResolvedValue([mockRegistration]);
      standingRepo.update.mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] });

      let savedStanding: any = null;
      
      const result = await service.calculateTournamentStandings('tournament-1');

      // Verify CS point calculation from returned standings
      expect(result).toHaveLength(1);
      savedStanding = result[0];

      // Placement points: 1st place = 50 points
      // Round win points: 16 rounds * 3 = 48 points
      // Kill points: 25 kills * 1 = 25 points
      // Death penalty: 15 deaths * -1 = -15 points
      // Assist points: 10 assists * 0.5 = 5 points
      // MVP bonus: 3 MVP rounds * 5 = 15 points
      // ADR bonus: (150 ADR - 100) * 0.1 = 5 points
      // Headshot bonus: 40% HS * 10 = 4 points
      // Total: 50 + 48 + 25 - 15 + 5 + 15 + 5 + 4 = 137 points

      expect(savedStanding.points).toBe(137);
      expect(savedStanding.wins).toBe(1);
      expect(savedStanding.losses).toBe(0);
      expect(savedStanding.kills).toBe(25);
      expect(savedStanding.deaths).toBe(15);
      expect(savedStanding.assists).toBe(8);
      expect(savedStanding.roundsWon).toBe(16);
      expect(savedStanding.roundsLost).toBe(14);
      expect(savedStanding.adr).toBeCloseTo(85.5, 1);
      expect(savedStanding.hsPercentage).toBeCloseTo(45.2, 1);
    });
  });
});
