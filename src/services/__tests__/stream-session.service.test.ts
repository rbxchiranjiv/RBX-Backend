import { Test, TestingModule } from '@nestjs/testing';
import { Repository, DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StreamSessionService } from '../stream-session.service';
import { CacheService } from '../cache.service';
import { NotificationService } from '../notification.service';
import { StreamSessionEntity, StreamStatus, StreamType, StreamQuality } from '../../database/entities/stream-session.entity';
import { TournamentEntity } from '../../database/entities/tournament.entity';
import { MatchEntity } from '../../database/entities/match.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { NotFoundError, ValidationError } from '../errors';

describe.skip('StreamSessionService', () => {
  let service: StreamSessionService;
  let streamSessionRepo: jest.Mocked<Repository<StreamSessionEntity>>;
  let tournamentRepo: jest.Mocked<Repository<TournamentEntity>>;
  let matchRepo: jest.Mocked<Repository<MatchEntity>>;
  let userRepo: jest.Mocked<Repository<UserEntity>>;
  let cacheService: any;
  let notificationService: any;
  let dataSource: jest.Mocked<DataSource>;

  const mockUser: UserEntity = {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as UserEntity;

  const mockTournament: TournamentEntity = {
    id: 'tournament-1',
    name: 'Test Tournament',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as TournamentEntity;

  const mockMatch: MatchEntity = {
    id: 'match-1',
    code: 'MATCH-001',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as MatchEntity;

  const mockStreamSession: StreamSessionEntity = {
    id: 'stream-1',
    streamerId: 'user-1',
    type: StreamType.MATCH,
    status: StreamStatus.PENDING,
    title: 'Test Stream',
    quality: StreamQuality.AUTO,
    metadata: {
      platform: 'test',
      recordingEnabled: true,
      autoHighlightEnabled: true,
      tags: [],
    },
    streamStats: {},
    recordingMetadata: {},
    highlightMarkers: [],
    maxViewers: 0,
    region: 'global',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as StreamSessionEntity;

  beforeEach(async () => {
    const mockRepository = () => ({
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    });

    const mockCacheService = () => ({
      get: jest.fn() as any,
      set: jest.fn() as any,
      delete: jest.fn() as any,
    });

    const mockNotificationService = () => ({
      create: jest.fn(),
    });

    const mockDataSource = () => ({
      transaction: jest.fn(),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreamSessionService,
        { provide: getRepositoryToken(StreamSessionEntity), useFactory: mockRepository },
        { provide: getRepositoryToken(TournamentEntity), useFactory: mockRepository },
        { provide: getRepositoryToken(MatchEntity), useFactory: mockRepository },
        { provide: getRepositoryToken(UserEntity), useFactory: mockRepository },
        { provide: CacheService, useFactory: mockCacheService },
        { provide: NotificationService, useFactory: mockNotificationService },
        { provide: DataSource, useFactory: mockDataSource },
      ],
    }).compile();

    service = module.get<StreamSessionService>(StreamSessionService);
    streamSessionRepo = module.get(getRepositoryToken(StreamSessionEntity));
    tournamentRepo = module.get(getRepositoryToken(TournamentEntity));
    matchRepo = module.get(getRepositoryToken(MatchEntity));
    userRepo = module.get(getRepositoryToken(UserEntity));
    cacheService = module.get(CacheService);
    notificationService = module.get(NotificationService);
    dataSource = module.get(DataSource);
  });

  describe('create', () => {
    it('should create a stream session successfully', async () => {
      const createInput = {
        streamerId: 'user-1',
        type: StreamType.MATCH,
        title: 'Test Stream',
        tournamentId: 'tournament-1',
      };

      userRepo.findOne.mockResolvedValue(mockUser);
      tournamentRepo.findOne.mockResolvedValue(mockTournament);
      streamSessionRepo.create.mockReturnValue(mockStreamSession);
      streamSessionRepo.save.mockResolvedValue(mockStreamSession);
      cacheService.set.mockResolvedValue(undefined);
      notificationService.create.mockResolvedValue(undefined);

      const result = await service.create(createInput);

      expect(result).toEqual(mockStreamSession);
      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { id: 'user-1' } });
      expect(tournamentRepo.findOne).toHaveBeenCalledWith({ where: { id: 'tournament-1' } });
      expect(streamSessionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...createInput,
          status: StreamStatus.PENDING,
          quality: StreamQuality.AUTO,
        })
      );
      expect(cacheService.set).toHaveBeenCalledWith(
        'stream_session:stream-1',
        mockStreamSession,
        3600
      );
      expect(notificationService.create).toHaveBeenCalledWith({
        userId: 'user-1',
        templateKey: 'stream_session_created',
        channel: 'inApp',
        payload: expect.objectContaining({
          sessionId: 'stream-1',
          title: 'Test Stream',
        }),
      });
    });

    it('should throw NotFoundError if streamer not found', async () => {
      const createInput = {
        streamerId: 'invalid-user',
        type: StreamType.MATCH,
        title: 'Test Stream',
      };

      userRepo.findOne.mockResolvedValue(null);

      await expect(service.create(createInput)).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError if tournament not found', async () => {
      const createInput = {
        streamerId: 'user-1',
        type: StreamType.MATCH,
        title: 'Test Stream',
        tournamentId: 'invalid-tournament',
      };

      userRepo.findOne.mockResolvedValue(mockUser);
      tournamentRepo.findOne.mockResolvedValue(null);

      await expect(service.create(createInput)).rejects.toThrow(NotFoundError);
    });
  });

  describe('findById', () => {
    it('should return cached stream session', async () => {
      cacheService.get.mockResolvedValue(mockStreamSession);

      const result = await service.findById('stream-1');

      expect(result).toEqual(mockStreamSession);
      expect(cacheService.get).toHaveBeenCalledWith('stream_session:stream-1');
      expect(streamSessionRepo.findOne).not.toHaveBeenCalled();
    });

    it('should fetch from database if not cached', async () => {
      cacheService.get.mockResolvedValue(null);
      streamSessionRepo.findOne.mockResolvedValue(mockStreamSession);
      cacheService.set.mockResolvedValue(undefined);

      const result = await service.findById('stream-1');

      expect(result).toEqual(mockStreamSession);
      expect(streamSessionRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'stream-1' },
        relations: ['streamer', 'tournament', 'match'],
      });
      expect(cacheService.set).toHaveBeenCalledWith(
        'stream_session:stream-1',
        mockStreamSession,
        3600
      );
    });

    it('should return null if stream session not found', async () => {
      cacheService.get.mockResolvedValue(null);
      streamSessionRepo.findOne.mockResolvedValue(null);

      const result = await service.findById('invalid-stream');

      expect(result).toBeNull();
    });
  });

  describe('startStream', () => {
    it('should start a stream successfully', async () => {
      const startedStream = {
        ...mockStreamSession,
        status: StreamStatus.LIVE,
        startedAt: new Date(),
      };

      cacheService.get.mockResolvedValue(mockStreamSession);
      streamSessionRepo.save.mockResolvedValue(startedStream);
      cacheService.set.mockResolvedValue(undefined);
      notificationService.create.mockResolvedValue(undefined);

      const result = await service.startStream('stream-1');

      expect(result).toEqual(startedStream);
      expect(streamSessionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: StreamStatus.LIVE,
          startedAt: expect.any(Date),
        })
      );
      expect(notificationService.create).toHaveBeenCalledWith({
        userId: 'user-1',
        templateKey: 'stream_started',
        channel: 'inApp',
        payload: expect.objectContaining({
          sessionId: 'stream-1',
          startedAt: expect.any(Date),
        }),
      });
    });

    it('should throw NotFoundError if stream session not found', async () => {
      cacheService.get.mockResolvedValue(null);
      streamSessionRepo.findOne.mockResolvedValue(null);

      await expect(service.startStream('invalid-stream')).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError if stream is not pending', async () => {
      const liveStream = { ...mockStreamSession, status: StreamStatus.LIVE };
      cacheService.get.mockResolvedValue(liveStream);

      await expect(service.startStream('stream-1')).rejects.toThrow(ValidationError);
    });
  });

  describe('endStream', () => {
    it('should end a stream successfully', async () => {
      const liveStream = {
        ...mockStreamSession,
        status: StreamStatus.LIVE,
        startedAt: new Date(Date.now() - 60000), // 1 minute ago
      };
      const endedStream = {
        ...liveStream,
        status: StreamStatus.ENDED,
        endedAt: new Date(),
        streamStats: {
          duration: 60,
          avgViewers: 10,
          peakViewers: 15,
        },
      };

      cacheService.get.mockResolvedValue(liveStream);
      streamSessionRepo.save.mockResolvedValue(endedStream);
      cacheService.set.mockResolvedValue(undefined);
      notificationService.create.mockResolvedValue(undefined);

      const result = await service.endStream('stream-1', 'Stream ended manually');

      expect(result).toEqual(endedStream);
      expect(streamSessionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: StreamStatus.ENDED,
          endedAt: expect.any(Date),
          streamStats: expect.objectContaining({
            duration: expect.any(Number),
          }),
        })
      );
      expect(notificationService.create).toHaveBeenCalledWith({
        userId: 'user-1',
        templateKey: 'stream_ended',
        channel: 'inApp',
        payload: expect.objectContaining({
          sessionId: 'stream-1',
          reason: 'Stream ended manually',
        }),
      });
    });

    it('should throw ValidationError if stream is not live', async () => {
      cacheService.get.mockResolvedValue(mockStreamSession);

      await expect(service.endStream('stream-1')).rejects.toThrow(ValidationError);
    });
  });

  describe('updateViewerCount', () => {
    it('should update viewer count successfully', async () => {
      cacheService.get.mockResolvedValue(mockStreamSession);
      streamSessionRepo.save.mockResolvedValue(mockStreamSession);
      cacheService.set.mockResolvedValue(undefined);

      await service.updateViewerCount('stream-1', 25);

      expect(streamSessionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          viewerCount: 25,
          maxViewers: 25, // Should update max viewers
        })
      );
    });

    it('should update max viewers if new count is higher', async () => {
      const streamWithMaxViewers = { ...mockStreamSession, maxViewers: 20 };
      cacheService.get.mockResolvedValue(streamWithMaxViewers);
      streamSessionRepo.save.mockResolvedValue(streamWithMaxViewers);
      cacheService.set.mockResolvedValue(undefined);

      await service.updateViewerCount('stream-1', 25);

      expect(streamSessionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          viewerCount: 25,
          maxViewers: 25,
        })
      );
    });

    it('should not update max viewers if new count is lower', async () => {
      const streamWithMaxViewers = { ...mockStreamSession, maxViewers: 30 };
      cacheService.get.mockResolvedValue(streamWithMaxViewers);
      streamSessionRepo.save.mockResolvedValue(streamWithMaxViewers);
      cacheService.set.mockResolvedValue(undefined);

      await service.updateViewerCount('stream-1', 25);

      expect(streamSessionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          viewerCount: 25,
          maxViewers: 30, // Should keep existing max
        })
      );
    });
  });

  describe('addHighlightMarker', () => {
    it('should add highlight marker successfully', async () => {
      const marker = {
        timestamp: 120,
        type: 'kill' as const,
        description: 'Amazing headshot',
        confidence: 0.9,
      };

      cacheService.get.mockResolvedValue(mockStreamSession);
      streamSessionRepo.save.mockResolvedValue(mockStreamSession);
      cacheService.set.mockResolvedValue(undefined);

      await service.addHighlightMarker('stream-1', marker);

      expect(streamSessionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          highlightMarkers: expect.arrayContaining([
            expect.objectContaining(marker),
          ]),
        })
      );
    });
  });

  describe('findMany', () => {
    it('should return paginated stream sessions', async () => {
      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockStreamSession], 1]),
      } as any;

      streamSessionRepo.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.findMany({
        streamerId: 'user-1',
        status: StreamStatus.LIVE,
        limit: 10,
        offset: 0,
      });

      expect(result).toEqual({
        sessions: [mockStreamSession],
        total: 1,
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('streamSession.streamerId = :streamerId', {
        streamerId: 'user-1',
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('streamSession.status = :status', {
        status: StreamStatus.LIVE,
      });
      expect(queryBuilder.limit).toHaveBeenCalledWith(10);
      expect(queryBuilder.offset).toHaveBeenCalledWith(0);
    });
  });

  describe('delete', () => {
    it('should delete stream session successfully', async () => {
      cacheService.get.mockResolvedValue(mockStreamSession);
      streamSessionRepo.remove.mockResolvedValue(mockStreamSession);
      cacheService.delete.mockResolvedValue(undefined);

      await service.delete('stream-1');

      expect(streamSessionRepo.remove).toHaveBeenCalledWith(mockStreamSession);
      expect(cacheService.delete).toHaveBeenCalledWith('stream_session:stream-1');
    });

    it('should throw ValidationError if stream is live', async () => {
      const liveStream = { ...mockStreamSession, status: StreamStatus.LIVE };
      cacheService.get.mockResolvedValue(liveStream);

      await expect(service.delete('stream-1')).rejects.toThrow(ValidationError);
    });
  });

  describe('getActiveStreams', () => {
    it('should return cached active streams', async () => {
      const activeStreams = [mockStreamSession];
      cacheService.get.mockResolvedValue(activeStreams);

      const result = await service.getActiveStreams();

      expect(result).toEqual(activeStreams);
      expect(streamSessionRepo.find).not.toHaveBeenCalled();
    });

    it('should fetch active streams from database', async () => {
      const activeStreams = [mockStreamSession];
      cacheService.get.mockResolvedValue(null);
      streamSessionRepo.find.mockResolvedValue(activeStreams);
      cacheService.set.mockResolvedValue(undefined);

      const result = await service.getActiveStreams();

      expect(result).toEqual(activeStreams);
      expect(streamSessionRepo.find).toHaveBeenCalledWith({
        where: { status: StreamStatus.LIVE },
        relations: ['streamer', 'tournament', 'match'],
        order: { startedAt: 'DESC' },
      });
      expect(cacheService.set).toHaveBeenCalledWith('active_streams', activeStreams, 300);
    });
  });

  describe('getStreamerStats', () => {
    it('should return streamer statistics', async () => {
      const endedStreams = [
        { ...mockStreamSession, streamStats: { duration: 120, totalViews: 100 }, maxViewers: 50 },
        { ...mockStreamSession, streamStats: { duration: 180, totalViews: 150 }, maxViewers: 75 },
      ];
      streamSessionRepo.find.mockResolvedValue(endedStreams);

      const result = await service.getStreamerStats('user-1');

      expect(result).toEqual({
        totalSessions: 2,
        totalDuration: 300,
        totalViews: 250,
        avgViewers: 125,
        maxViewers: 75,
      });
    });

    it('should return zero stats for streamer with no streams', async () => {
      streamSessionRepo.find.mockResolvedValue([]);

      const result = await service.getStreamerStats('user-1');

      expect(result).toEqual({
        totalSessions: 0,
        totalDuration: 0,
        totalViews: 0,
        avgViewers: 0,
        maxViewers: 0,
      });
    });
  });
});
