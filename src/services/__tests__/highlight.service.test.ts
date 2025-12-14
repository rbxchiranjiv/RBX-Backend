import { Test, TestingModule } from '@nestjs/testing';
import { Repository, DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HighlightService } from '../highlight.service';
import { CacheService } from '../cache.service';
import { NotificationService } from '../notification.service';
import { HighlightEntity, HighlightType, HighlightSource, HighlightStatus } from '../../database/entities/highlight.entity';
import { StreamSessionEntity } from '../../database/entities/stream-session.entity';
import { MatchEntity } from '../../database/entities/match.entity';
import { TournamentEntity } from '../../database/entities/tournament.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { NotFoundError, ValidationError } from '../errors';

describe.skip('HighlightService', () => {
  let service: HighlightService;
  let highlightRepo: jest.Mocked<Repository<HighlightEntity>>;
  let streamSessionRepo: jest.Mocked<Repository<StreamSessionEntity>>;
  let matchRepo: jest.Mocked<Repository<MatchEntity>>;
  let tournamentRepo: jest.Mocked<Repository<TournamentEntity>>;
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

  const mockStreamSession: StreamSessionEntity = {
    id: 'stream-1',
    streamerId: 'user-1',
    title: 'Test Stream',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as StreamSessionEntity;

  const mockHighlight: HighlightEntity = {
    id: 'highlight-1',
    streamSessionId: 'stream-1',
    createdBy: 'user-1',
    type: HighlightType.KILL,
    source: HighlightSource.AUTO_GENERATED,
    title: 'Amazing Kill',
    startTime: 120,
    endTime: 130,
    status: HighlightStatus.PROCESSING,
    engagement: {
      views: 0,
      likes: 0,
      shares: 0,
      downloads: 0,
      comments: 0,
      watchTime: 0,
    },
    processingMetadata: {
      processingSteps: [],
      retryCount: 0,
    },
    aiMetadata: {
      confidence: 0.9,
      detectedEvents: [],
      tags: [],
    },
    metadata: {
      platform: 'test',
      tags: [],
    },
    region: 'global',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as HighlightEntity;

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
        HighlightService,
        { provide: getRepositoryToken(HighlightEntity), useFactory: mockRepository },
        { provide: getRepositoryToken(StreamSessionEntity), useFactory: mockRepository },
        { provide: getRepositoryToken(MatchEntity), useFactory: mockRepository },
        { provide: getRepositoryToken(TournamentEntity), useFactory: mockRepository },
        { provide: getRepositoryToken(UserEntity), useFactory: mockRepository },
        { provide: CacheService, useFactory: mockCacheService },
        { provide: NotificationService, useFactory: mockNotificationService },
        { provide: DataSource, useFactory: mockDataSource },
      ],
    }).compile();

    service = module.get<HighlightService>(HighlightService);
    highlightRepo = module.get(getRepositoryToken(HighlightEntity));
    streamSessionRepo = module.get(getRepositoryToken(StreamSessionEntity));
    matchRepo = module.get(getRepositoryToken(MatchEntity));
    tournamentRepo = module.get(getRepositoryToken(TournamentEntity));
    userRepo = module.get(getRepositoryToken(UserEntity));
    cacheService = module.get(CacheService);
    notificationService = module.get(NotificationService);
    dataSource = module.get(DataSource);
  });

  describe('create', () => {
    it('should create a highlight successfully', async () => {
      const createInput = {
        streamSessionId: 'stream-1',
        createdBy: 'user-1',
        type: HighlightType.KILL,
        source: HighlightSource.AUTO_GENERATED,
        title: 'Amazing Kill',
        startTime: 120,
        endTime: 125,
      } as any;

      streamSessionRepo.findOne.mockResolvedValue(mockStreamSession);
      userRepo.findOne.mockResolvedValue(mockUser);
      highlightRepo.create.mockReturnValue(mockHighlight);
      highlightRepo.save.mockResolvedValue(mockHighlight);
      cacheService.set.mockResolvedValue(undefined);
      notificationService.create.mockResolvedValue(undefined);

      const result = await service.create(createInput);

      expect(result).toEqual(mockHighlight);
      expect(streamSessionRepo.findOne).toHaveBeenCalledWith({ where: { id: 'stream-1' } });
      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { id: 'user-1' } });
      expect(highlightRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...createInput,
          duration: 5, // endTime - startTime
          status: HighlightStatus.PROCESSING,
        })
      );
      expect(cacheService.set).toHaveBeenCalledWith(
        'highlight:highlight-1',
        mockHighlight,
        3600
      );
      expect(notificationService.create).toHaveBeenCalledWith({
        userId: 'user-1',
        templateKey: 'highlight_created',
        channel: 'inApp',
        payload: expect.objectContaining({
          highlightId: 'highlight-1',
          title: 'Amazing Kill',
        }),
      });
    });

    it('should throw NotFoundError if stream session not found', async () => {
      const createInput = {
        streamSessionId: 'invalid-stream',
        createdBy: 'user-1',
        type: HighlightType.KILL,
        source: HighlightSource.AUTO_GENERATED,
        title: 'Amazing Kill',
        startTime: 120,
        endTime: 125,
      } as any;

      streamSessionRepo.findOne.mockResolvedValue(null);

      await expect(service.create(createInput)).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError if end time is before start time', async () => {
      const createInput = {
        streamSessionId: 'stream-1',
        createdBy: 'user-1',
        type: HighlightType.KILL,
        source: HighlightSource.AUTO_GENERATED,
        title: 'Invalid Highlight',
        startTime: 125,
        endTime: 120, // Invalid
      } as any;

      streamSessionRepo.findOne.mockResolvedValue(mockStreamSession);

      await expect(service.create(createInput)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if duration exceeds 5 minutes', async () => {
      const createInput = {
        streamSessionId: 'stream-1',
        createdBy: 'user-1',
        type: HighlightType.KILL,
        source: HighlightSource.AUTO_GENERATED,
        title: 'Long Highlight',
        startTime: 0,
        endTime: 301, // 5 minutes + 1 second
      } as any;

      streamSessionRepo.findOne.mockResolvedValue(mockStreamSession);

      await expect(service.create(createInput)).rejects.toThrow(ValidationError);
    });
  });

  describe('completeProcessing', () => {
    it('should complete highlight processing successfully', async () => {
      const completedHighlight = {
        ...mockHighlight,
        status: HighlightStatus.READY,
        videoUrl: 'https://cdn.example.com/highlight.mp4',
        downloadUrl: 'https://cdn.example.com/highlight.mp4?download=1',
        thumbnailUrl: 'https://cdn.example.com/thumbnail.jpg',
        videoMetadata: {
          format: 'mp4',
          resolution: '1920x1080',
          fps: 30,
          bitrate: 5000,
          fileSize: 1048576, // 1MB
        },
      } as any;

      cacheService.get.mockResolvedValue(mockHighlight);
      highlightRepo.save.mockResolvedValue(completedHighlight);
      cacheService.set.mockResolvedValue(undefined);
      notificationService.create.mockResolvedValue(undefined);

      const videoData = {
        videoUrl: 'https://cdn.example.com/highlight.mp4',
        downloadUrl: 'https://cdn.example.com/highlight.mp4?download=1',
        thumbnailUrl: 'https://cdn.example.com/thumbnail.jpg',
        videoMetadata: {
          format: 'mp4',
          resolution: '1920x1080',
          fps: 30,
          bitrate: 5000,
          fileSize: 1048576,
          codec: 'h264',
        },
      } as any;

      const result = await service.completeProcessing('highlight-1', videoData);

      expect(result).toEqual(completedHighlight);
      expect(highlightRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: HighlightStatus.READY,
          videoUrl: videoData.videoUrl,
          downloadUrl: videoData.downloadUrl,
          thumbnailUrl: videoData.thumbnailUrl,
        })
      );
      expect(notificationService.create).toHaveBeenCalledWith({
        userId: 'user-1',
        templateKey: 'highlight_ready',
        channel: 'inApp',
        payload: expect.objectContaining({
          highlightId: 'highlight-1',
          videoUrl: videoData.videoUrl,
        }),
      });
    });

    it('should throw NotFoundError if highlight not found', async () => {
      cacheService.get.mockResolvedValue(null);
      highlightRepo.findOne.mockResolvedValue(null);

      await expect(service.completeProcessing('invalid-highlight', {} as any)).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError if highlight is not processing', async () => {
      const readyHighlight = { ...mockHighlight, status: HighlightStatus.READY } as any;
      cacheService.get.mockResolvedValue(readyHighlight);

      await expect(service.completeProcessing('highlight-1', {} as any)).rejects.toThrow(ValidationError);
    });
  });

  describe('approveHighlight', () => {
    it('should approve a highlight successfully', async () => {
      const approvedHighlight = {
        ...mockHighlight,
        status: HighlightStatus.APPROVED,
        approvedBy: 'admin-1',
        approvedAt: new Date(),
      } as any;

      cacheService.get.mockResolvedValue(mockHighlight);
      userRepo.findOne.mockResolvedValue(mockUser);
      highlightRepo.save.mockResolvedValue(approvedHighlight);
      cacheService.set.mockResolvedValue(undefined);
      notificationService.create.mockResolvedValue(undefined);

      const result = await service.approveHighlight('highlight-1', 'admin-1');

      expect(result).toEqual(approvedHighlight);
      expect(highlightRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: HighlightStatus.APPROVED,
          approvedBy: 'admin-1',
          approvedAt: expect.any(Date),
        })
      );
      expect(notificationService.create).toHaveBeenCalledWith({
        userId: 'user-1',
        templateKey: 'highlight_approved',
        channel: 'inApp',
        payload: expect.objectContaining({
          highlightId: 'highlight-1',
        }),
      });
    });

    it('should throw ValidationError if highlight is not ready', async () => {
      const processingHighlight = { ...mockHighlight, status: HighlightStatus.PROCESSING } as any;
      cacheService.get.mockResolvedValue(processingHighlight);

      await expect(service.approveHighlight('highlight-1', 'admin-1')).rejects.toThrow(ValidationError);
    });
  });

  describe('rejectHighlight', () => {
    it('should reject a highlight successfully', async () => {
      const rejectedHighlight = {
        ...mockHighlight,
        status: HighlightStatus.REJECTED,
        approvedBy: 'admin-1',
        approvedAt: new Date(),
        rejectionReason: 'Low quality content',
      } as any;

      cacheService.get.mockResolvedValue(mockHighlight);
      userRepo.findOne.mockResolvedValue(mockUser);
      highlightRepo.save.mockResolvedValue(rejectedHighlight);
      cacheService.set.mockResolvedValue(undefined);
      notificationService.create.mockResolvedValue(undefined);

      const result = await service.rejectHighlight('highlight-1', 'admin-1', 'Low quality content');

      expect(result).toEqual(rejectedHighlight);
      expect(highlightRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: HighlightStatus.REJECTED,
          approvedBy: 'admin-1',
          approvedAt: expect.any(Date),
          rejectionReason: 'Low quality content',
        })
      );
      expect(notificationService.create).toHaveBeenCalledWith({
        userId: 'user-1',
        templateKey: 'highlight_rejected',
        channel: 'inApp',
        payload: expect.objectContaining({
          highlightId: 'highlight-1',
          rejectionReason: 'Low quality content',
        }),
      });
    });
  });

  describe('publishHighlight', () => {
    it('should publish a highlight successfully', async () => {
      const approvedHighlight = { ...mockHighlight, status: HighlightStatus.APPROVED } as any;
      const publishedHighlight = {
        ...approvedHighlight,
        status: HighlightStatus.PUBLISHED,
        publishedAt: new Date(),
      } as any;

      cacheService.get.mockResolvedValue(approvedHighlight);
      highlightRepo.save.mockResolvedValue(publishedHighlight);
      cacheService.set.mockResolvedValue(undefined);
      notificationService.create.mockResolvedValue(undefined);

      const result = await service.publishHighlight('highlight-1');

      expect(result).toEqual(publishedHighlight);
      expect(highlightRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: HighlightStatus.PUBLISHED,
          publishedAt: expect.any(Date),
        })
      );
      expect(notificationService.create).toHaveBeenCalledWith({
        userId: 'user-1',
        templateKey: 'highlight_published',
        channel: 'inApp',
        payload: expect.objectContaining({
          highlightId: 'highlight-1',
        }),
      });
    });

    it('should throw ValidationError if highlight is not approved', async () => {
      cacheService.get.mockResolvedValue(mockHighlight);

      await expect(service.publishHighlight('highlight-1')).rejects.toThrow(ValidationError);
    });
  });

  describe('updateEngagement', () => {
    it('should update engagement metrics successfully', async () => {
      const engagementData = {
        views: 100,
        likes: 25,
        shares: 10,
      } as any;

      cacheService.get.mockResolvedValue(mockHighlight);
      highlightRepo.save.mockResolvedValue(mockHighlight);
      cacheService.set.mockResolvedValue(undefined);

      await service.updateEngagement('highlight-1', engagementData);

      expect(highlightRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          engagement: expect.objectContaining(engagementData),
        })
      );
    });
  });

  describe('findMany', () => {
    it('should return paginated highlights', async () => {
      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockHighlight], 1]),
      } as any;

      highlightRepo.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.findMany({
        createdBy: 'user-1',
        status: HighlightStatus.PUBLISHED,
        limit: 10,
        offset: 0,
      });

      expect(result).toEqual({
        highlights: [mockHighlight],
        total: 1,
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('highlight.createdBy = :createdBy', {
        createdBy: 'user-1',
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('highlight.status = :status', {
        status: HighlightStatus.PUBLISHED,
      });
    });
  });

  describe('getHighlightsByStream', () => {
    it('should return cached highlights by stream', async () => {
      const streamHighlights = [mockHighlight];
      cacheService.get.mockResolvedValue(streamHighlights);

      const result = await service.getHighlightsByStream('stream-1');

      expect(result).toEqual(streamHighlights);
      expect(highlightRepo.find).not.toHaveBeenCalled();
    });

    it('should fetch highlights by stream from database', async () => {
      const streamHighlights = [mockHighlight];
      cacheService.get.mockResolvedValue(null);
      highlightRepo.find.mockResolvedValue(streamHighlights);
      cacheService.set.mockResolvedValue(undefined);

      const result = await service.getHighlightsByStream('stream-1');

      expect(result).toEqual(streamHighlights);
      expect(highlightRepo.find).toHaveBeenCalledWith({
        where: { streamSessionId: 'stream-1' },
        relations: ['creator'],
        order: { createdAt: 'DESC' },
      });
      expect(cacheService.set).toHaveBeenCalledWith(
        'highlights_stream:stream-1',
        streamHighlights,
        300
      );
    });
  });

  describe('getPendingHighlights', () => {
    it('should return cached pending highlights', async () => {
      const pendingHighlights = [mockHighlight];
      cacheService.get.mockResolvedValue(pendingHighlights);

      const result = await service.getPendingHighlights();

      expect(result).toEqual(pendingHighlights);
      expect(highlightRepo.find).not.toHaveBeenCalled();
    });

    it('should fetch pending highlights from database', async () => {
      const pendingHighlights = [mockHighlight];
      cacheService.get.mockResolvedValue(null);
      highlightRepo.find.mockResolvedValue(pendingHighlights);
      cacheService.set.mockResolvedValue(undefined);

      const result = await service.getPendingHighlights();

      expect(result).toEqual(pendingHighlights);
      expect(highlightRepo.find).toHaveBeenCalledWith({
        where: { status: HighlightStatus.READY },
        relations: ['creator', 'streamSession'],
        order: { createdAt: 'ASC' },
      });
      expect(cacheService.set).toHaveBeenCalledWith('pending_highlights', pendingHighlights, 120);
    });
  });

  describe('getHighlightStats', () => {
    it('should return highlight statistics', async () => {
      const highlights = [
        { ...mockHighlight, status: HighlightStatus.PUBLISHED, engagement: { views: 100, likes: 25, shares: 10 } },
        { ...mockHighlight, status: HighlightStatus.READY },
        { ...mockHighlight, status: HighlightStatus.REJECTED },
      ];
      highlightRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(highlights),
      } as any);

      const result = await service.getHighlightStats('user-1');

      expect(result).toEqual({
        totalHighlights: 3,
        totalViews: 100,
        totalLikes: 25,
        totalShares: 10,
        avgDuration: 5, // All highlights have duration 5
        publishedHighlights: 1,
        pendingHighlights: 1,
        rejectedHighlights: 1,
      });
    });

    it('should return zero stats for user with no highlights', async () => {
      highlightRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      } as any);

      const result = await service.getHighlightStats('user-1');

      expect(result).toEqual({
        totalHighlights: 0,
        totalViews: 0,
        totalLikes: 0,
        totalShares: 0,
        avgDuration: 0,
        publishedHighlights: 0,
        pendingHighlights: 0,
        rejectedHighlights: 0,
      });
    });
  });
});
