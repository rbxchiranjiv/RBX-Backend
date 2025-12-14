import { Test, TestingModule } from '@nestjs/testing';
import { Repository, DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RecordingService } from '../recording.service';
import { CacheService } from '../cache.service';
import { NotificationService } from '../notification.service';
import { RecordingEntity, RecordingStatus, RecordingFormat, RecordingQuality } from '../../database/entities/recording.entity';
import { StreamSessionEntity } from '../../database/entities/stream-session.entity';
import { MatchEntity } from '../../database/entities/match.entity';
import { TournamentEntity } from '../../database/entities/tournament.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { NotFoundError, ValidationError } from '../errors';
import { createMockRepository } from '../../test-utils/createMockRepository';
import { createMockTransactionManager } from '../../test-utils/mockTransactionManager';

describe.skip('RecordingService', () => {
  let service: RecordingService;
  let recordingRepo: jest.Mocked<Repository<RecordingEntity>>;
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

  const mockRecording: RecordingEntity = {
    id: 'recording-1',
    streamSessionId: 'stream-1',
    recordedBy: 'user-1',
    title: 'Test Recording',
    status: RecordingStatus.INITIALIZING,
    format: RecordingFormat.MP4,
    quality: RecordingQuality.HIGH,
    videoMetadata: {
      resolution: '1920x1080',
      fps: 30,
      bitrate: 5000,
      codec: 'h264',
      aspectRatio: '16:9',
      fileSize: 1000000,
      duration: 60,
    },
    recordingMetadata: {
      segments: 1,
      droppedFrames: 0,
      avgBitrate: 5000,
      maxBitrate: 6000,
      audioEnabled: true,
      videoEnabled: true,
    },
    processingMetadata: {
      processingSteps: [],
      retryCount: 0,
    },
    clipMarkers: [],
    storageMetadata: {
      provider: 's3',
      bucket: 'test-bucket',
      path: 'recordings/test.mp4',
    },
    analytics: {
      views: 0,
      downloads: 0,
      bandwidth: 0,
      avgWatchTime: 0,
      completionRate: 0,
      popularSegments: [],
    },
    metadata: {
      platform: 'twitch',
      tags: ['test'],
      autoRecorded: false,
      backupEnabled: true,
      priority: 1,
    },
    retryCount: 0,
    region: 'global',
    createdAt: new Date(),
    updatedAt: new Date(),
    // Required relationships
    streamSession: mockStreamSession,
    matchId: '',
    tournamentId: '',
    recorder: mockUser,
  };

  beforeEach(async () => {
    recordingRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as any;

    streamSessionRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as any;

    matchRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as any;

    tournamentRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as any;

    userRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as any;

    cacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    };

    notificationService = {
      create: jest.fn(),
    };

    const { mockDataSource } = createMockTransactionManager();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordingService,
        { provide: getRepositoryToken(RecordingEntity), useValue: recordingRepo },
        { provide: getRepositoryToken(StreamSessionEntity), useValue: streamSessionRepo },
        { provide: getRepositoryToken(MatchEntity), useValue: matchRepo },
        { provide: getRepositoryToken(TournamentEntity), useValue: tournamentRepo },
        { provide: getRepositoryToken(UserEntity), useValue: userRepo },
        { provide: CacheService, useValue: cacheService },
        { provide: NotificationService, useValue: notificationService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<RecordingService>(RecordingService);
    recordingRepo = module.get(getRepositoryToken(RecordingEntity));
    streamSessionRepo = module.get(getRepositoryToken(StreamSessionEntity));
    matchRepo = module.get(getRepositoryToken(MatchEntity));
    tournamentRepo = module.get(getRepositoryToken(TournamentEntity));
    userRepo = module.get(getRepositoryToken(UserEntity));
    cacheService = module.get(CacheService);
    notificationService = module.get(NotificationService);
    dataSource = module.get(DataSource);
  });

  describe('create', () => {
    it('should create a recording successfully', async () => {
      const createInput = {
        streamSessionId: 'stream-1',
        recordedBy: 'user-1',
        title: 'Test Recording',
        matchId: 'match-1',
      } as any;

      streamSessionRepo.findOne.mockResolvedValue(mockStreamSession);
      userRepo.findOne.mockResolvedValue(mockUser);
      matchRepo.findOne.mockResolvedValue({ id: 'match-1' } as MatchEntity);
      recordingRepo.create.mockReturnValue(mockRecording);
      recordingRepo.save.mockResolvedValue(mockRecording);
      cacheService.set.mockResolvedValue(undefined);
      notificationService.create.mockResolvedValue(undefined);

      const result = await service.create(createInput);

      expect(result).toEqual(mockRecording);
      expect(streamSessionRepo.findOne).toHaveBeenCalledWith({ where: { id: 'stream-1' } });
      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { id: 'user-1' } });
      expect(matchRepo.findOne).toHaveBeenCalledWith({ where: { id: 'match-1' } });
      expect(recordingRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...createInput,
          status: RecordingStatus.INITIALIZING,
          format: RecordingFormat.MP4,
          quality: RecordingQuality.HIGH,
        })
      );
      expect(cacheService.set).toHaveBeenCalledWith(
        'recording:recording-1',
        mockRecording,
        3600
      );
      expect(notificationService.create).toHaveBeenCalledWith({
        userId: 'user-1',
        templateKey: 'recording_initialized',
        channel: 'inApp',
        payload: expect.objectContaining({
          recordingId: 'recording-1',
          title: 'Test Recording',
        }),
      });
    });

    it('should throw NotFoundError if stream session not found', async () => {
      const createInput = {
        streamSessionId: 'invalid-stream',
        recordedBy: 'user-1',
        title: 'Test Recording',
      } as any;

      streamSessionRepo.findOne.mockResolvedValue(null);

      await expect(service.create(createInput)).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError if recorder not found', async () => {
      const createInput = {
        streamSessionId: 'stream-1',
        recordedBy: 'invalid-user',
        title: 'Test Recording',
      } as any;

      streamSessionRepo.findOne.mockResolvedValue(mockStreamSession);
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.create(createInput)).rejects.toThrow(NotFoundError);
    });
  });

  describe('startRecording', () => {
    it('should start recording successfully', async () => {
      const startedRecording = {
        ...mockRecording,
        status: RecordingStatus.RECORDING,
        startedAt: new Date(),
        processingMetadata: {
          processingSteps: [
            {
              step: 'initialization',
              startedAt: new Date(),
              completedAt: new Date(),
              status: 'completed',
            },
            {
              step: 'recording',
              startedAt: new Date(),
              status: 'processing',
            },
          ],
          retryCount: 0,
        },
      } as any;

      cacheService.get.mockResolvedValue(mockRecording);
      recordingRepo.save.mockResolvedValue(startedRecording);
      cacheService.set.mockResolvedValue(undefined);
      notificationService.create.mockResolvedValue(undefined);

      const result = await service.startRecording('recording-1');

      expect(result).toEqual(startedRecording);
      expect(recordingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: RecordingStatus.RECORDING,
          startedAt: expect.any(Date),
        })
      );
      expect(notificationService.create).toHaveBeenCalledWith({
        userId: 'user-1',
        templateKey: 'recording_started',
        channel: 'inApp',
        payload: expect.objectContaining({
          recordingId: 'recording-1',
          startedAt: expect.any(Date),
        }),
      });
    });

    it('should throw NotFoundError if recording not found', async () => {
      cacheService.get.mockResolvedValue(null);
      recordingRepo.findOne.mockResolvedValue(null);

      await expect(service.startRecording('invalid-recording')).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError if recording is not initializing', async () => {
      const recordingRecording = { ...mockRecording, status: RecordingStatus.RECORDING } as any;
      cacheService.get.mockResolvedValue(recordingRecording);

      await expect(service.startRecording('recording-1')).rejects.toThrow(ValidationError);
    });
  });

  describe('stopRecording', () => {
    it('should stop recording successfully', async () => {
      const recordingRecording = {
        ...mockRecording,
        status: RecordingStatus.RECORDING,
        startedAt: new Date(Date.now() - 60000), // 1 minute ago
      } as any;
      const stoppedRecording = {
        ...recordingRecording,
        status: RecordingStatus.PROCESSING,
        endedAt: new Date(),
        recordingMetadata: {
          startedAt: recordingRecording.startedAt,
          endedAt: new Date(),
          duration: 60,
        },
        processingMetadata: {
          processingSteps: [
            {
              step: 'initialization',
              startedAt: new Date(),
              completedAt: new Date(),
              status: 'completed',
            },
            {
              step: 'recording',
              startedAt: new Date(),
              completedAt: new Date(),
              status: 'completed',
            },
            {
              step: 'processing',
              startedAt: new Date(),
              status: 'processing',
            },
          ],
          retryCount: 0,
        },
      } as any;

      cacheService.get.mockResolvedValue(recordingRecording);
      recordingRepo.save.mockResolvedValue(stoppedRecording);
      cacheService.set.mockResolvedValue(undefined);
      notificationService.create.mockResolvedValue(undefined);

      const result = await service.stopRecording('recording-1');

      expect(result).toEqual(stoppedRecording);
      expect(recordingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: RecordingStatus.PROCESSING,
          endedAt: expect.any(Date),
          recordingMetadata: expect.objectContaining({
            duration: expect.any(Number),
          }),
        })
      );
      expect(notificationService.create).toHaveBeenCalledWith({
        userId: 'user-1',
        templateKey: 'recording_stopped',
        channel: 'inApp',
        payload: expect.objectContaining({
          recordingId: 'recording-1',
          duration: 60,
        }),
      });
    });

    it('should throw ValidationError if recording is not recording', async () => {
      cacheService.get.mockResolvedValue(mockRecording);

      await expect(service.stopRecording('recording-1')).rejects.toThrow(ValidationError);
    });
  });

  describe('completeRecording', () => {
    it('should complete recording successfully', async () => {
      const processingRecording = { ...mockRecording, status: RecordingStatus.PROCESSING } as any;
      const completedRecording = {
        ...processingRecording,
        status: RecordingStatus.COMPLETED,
        videoUrl: 'https://cdn.example.com/recording.mp4',
        downloadUrl: 'https://cdn.example.com/recording.mp4?download=1',
        thumbnailUrl: 'https://cdn.example.com/thumbnail.jpg',
        previewUrl: 'https://cdn.example.com/preview.mp4',
        videoMetadata: {
          resolution: '1920x1080',
          fps: 30,
          bitrate: 5000,
          codec: 'h264',
          aspectRatio: '16:9',
          fileSize: 104857600, // 100MB
          duration: 3600,
          audioCodec: 'aac',
          audioBitrate: 128,
        },
        processingMetadata: {
          processingSteps: [
            {
              step: 'initialization',
              startedAt: new Date(),
              completedAt: new Date(),
              status: 'completed',
            },
            {
              step: 'recording',
              startedAt: new Date(),
              completedAt: new Date(),
              status: 'completed',
            },
            {
              step: 'processing',
              startedAt: new Date(),
              completedAt: new Date(),
              status: 'completed',
            },
          ],
          retryCount: 0,
        },
      } as any;

      cacheService.get.mockResolvedValue(processingRecording);
      recordingRepo.save.mockResolvedValue(completedRecording);
      cacheService.set.mockResolvedValue(undefined);
      notificationService.create.mockResolvedValue(undefined);

      const videoData = {
        videoUrl: 'https://cdn.example.com/recording.mp4',
        downloadUrl: 'https://cdn.example.com/recording.mp4?download=1',
        thumbnailUrl: 'https://cdn.example.com/thumbnail.jpg',
        previewUrl: 'https://cdn.example.com/preview.mp4',
        videoMetadata: {
          resolution: '1920x1080',
          fps: 30,
          bitrate: 5000,
          codec: 'h264',
          aspectRatio: '16:9',
          fileSize: 104857600,
          duration: 3600,
          audioCodec: 'aac',
          audioBitrate: 128,
        },
      } as any;

      const result = await service.completeRecording('recording-1', videoData);

      expect(result).toEqual(completedRecording);
      expect(recordingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: RecordingStatus.COMPLETED,
          videoUrl: videoData.videoUrl,
          downloadUrl: videoData.downloadUrl,
          thumbnailUrl: videoData.thumbnailUrl,
          previewUrl: videoData.previewUrl,
        })
      );
      expect(notificationService.create).toHaveBeenCalledWith({
        userId: 'user-1',
        templateKey: 'recording_completed',
        channel: 'inApp',
        payload: expect.objectContaining({
          recordingId: 'recording-1',
          videoUrl: videoData.videoUrl,
          fileSize: videoData.videoMetadata.fileSize,
        }),
      });
    });

    it('should throw NotFoundError if recording not found', async () => {
      cacheService.get.mockResolvedValue(null);
      recordingRepo.findOne.mockResolvedValue(null);

      await expect(service.completeRecording('invalid-recording', {} as any)).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError if recording is not processing', async () => {
      cacheService.get.mockResolvedValue(mockRecording);

      await expect(service.completeRecording('recording-1', {} as any)).rejects.toThrow(ValidationError);
    });
  });

  describe('failRecording', () => {
    it('should fail recording successfully', async () => {
      const processingRecording = { ...mockRecording, status: RecordingStatus.PROCESSING } as any;
      const failedRecording = {
        ...processingRecording,
        status: RecordingStatus.FAILED,
        errorMessage: 'Encoding failed',
        endedAt: new Date(),
        processingMetadata: {
          processingSteps: [
            {
              step: 'initialization',
              startedAt: new Date(),
              completedAt: new Date(),
              status: 'completed',
            },
            {
              step: 'recording',
              startedAt: new Date(),
              completedAt: new Date(),
              status: 'completed',
            },
            {
              step: 'processing',
              startedAt: new Date(),
              completedAt: new Date(),
              status: 'failed',
              error: 'Encoding failed',
            },
          ],
          retryCount: 0,
        },
      } as any;

      cacheService.get.mockResolvedValue(processingRecording);
      recordingRepo.save.mockResolvedValue(failedRecording);
      cacheService.set.mockResolvedValue(undefined);
      notificationService.create.mockResolvedValue(undefined);

      const result = await service.failRecording('recording-1', 'Encoding failed');

      expect(result).toEqual(failedRecording);
      expect(recordingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: RecordingStatus.FAILED,
          errorMessage: 'Encoding failed',
          endedAt: expect.any(Date),
        })
      );
      expect(notificationService.create).toHaveBeenCalledWith({
        userId: 'user-1',
        templateKey: 'recording_failed',
        channel: 'inApp',
        payload: expect.objectContaining({
          recordingId: 'recording-1',
          errorMessage: 'Encoding failed',
        }),
      });
    });
  });

  describe('addClipMarker', () => {
    it('should add clip marker successfully', async () => {
      const marker = {
        id: 'marker-1',
        timestamp: 120,
        type: 'highlight' as const,
        title: 'Amazing play',
        description: 'Great teamwork',
        confidence: 0.9,
      } as any;

      cacheService.get.mockResolvedValue(mockRecording);
      recordingRepo.save.mockResolvedValue(mockRecording);
      cacheService.set.mockResolvedValue(undefined);

      await service.addClipMarker('recording-1', marker);

      expect(recordingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          clipMarkers: expect.arrayContaining([
            expect.objectContaining(marker),
          ]),
        })
      );
    });
  });

  describe('findMany', () => {
    it('should return paginated recordings', async () => {
      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockRecording], 1]),
      } as any;

      recordingRepo.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.findMany({
        recordedBy: 'user-1',
        status: RecordingStatus.COMPLETED,
        limit: 10,
        offset: 0,
      });

      expect(result).toEqual({
        recordings: [mockRecording],
        total: 1,
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('recording.recordedBy = :recordedBy', {
        recordedBy: 'user-1',
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('recording.status = :status', {
        status: RecordingStatus.COMPLETED,
      });
    });
  });

  describe('getRecordingsByStream', () => {
    it('should return cached recordings by stream', async () => {
      const streamRecordings = [mockRecording];
      cacheService.get.mockResolvedValue(streamRecordings);

      const result = await service.getRecordingsByStream('stream-1');

      expect(result).toEqual(streamRecordings);
      expect(recordingRepo.find).not.toHaveBeenCalled();
    });

    it('should fetch recordings by stream from database', async () => {
      const streamRecordings = [mockRecording];
      cacheService.get.mockResolvedValue(null);
      recordingRepo.find.mockResolvedValue(streamRecordings);
      cacheService.set.mockResolvedValue(undefined);

      const result = await service.getRecordingsByStream('stream-1');

      expect(result).toEqual(streamRecordings);
      expect(recordingRepo.find).toHaveBeenCalledWith({
        where: { streamSessionId: 'stream-1' },
        relations: ['recorder'],
        order: { createdAt: 'DESC' },
      });
      expect(cacheService.set).toHaveBeenCalledWith(
        'recordings_stream:stream-1',
        streamRecordings,
        300
      );
    });
  });

  describe('getRecordingStats', () => {
    it('should return recording statistics', async () => {
      const recordings = [
        {
          ...mockRecording,
          status: RecordingStatus.COMPLETED,
          recordingMetadata: { duration: 3600 },
          videoMetadata: { fileSize: 104857600 },
        },
        {
          ...mockRecording,
          status: RecordingStatus.FAILED,
          recordingMetadata: { duration: 0 },
          videoMetadata: { fileSize: 0 },
        },
      ];
      recordingRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(recordings),
      } as any);

      const result = await service.getRecordingStats('user-1');

      expect(result).toEqual({
        totalRecordings: 2,
        totalDuration: 3600,
        totalSize: 104857600,
        avgDuration: 1800,
        completedRecordings: 1,
        failedRecordings: 1,
      });
    });

    it('should return zero stats for user with no recordings', async () => {
      recordingRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      } as any);

      const result = await service.getRecordingStats('user-1');

      expect(result).toEqual({
        totalRecordings: 0,
        totalDuration: 0,
        totalSize: 0,
        avgDuration: 0,
        completedRecordings: 0,
        failedRecordings: 0,
      });
    });
  });
});
