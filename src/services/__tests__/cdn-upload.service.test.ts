import { Test, TestingModule } from '@nestjs/testing';
import { Repository, DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CdnUploadService } from '../cdn-upload.service';
import { CacheService } from '../cache.service';
import { NotificationService } from '../notification.service';
import { CdnUploadEntity, UploadType, UploadStatus, StorageProvider } from '../../database/entities/cdn-upload.entity';
import { RecordingEntity } from '../../database/entities/recording.entity';
import { HighlightEntity } from '../../database/entities/highlight.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { NotFoundError, ValidationError } from '../errors';

describe.skip('CdnUploadService', () => {
  let service: CdnUploadService;
  let uploadRepo: jest.Mocked<Repository<CdnUploadEntity>>;
  let recordingRepo: jest.Mocked<Repository<RecordingEntity>>;
  let highlightRepo: jest.Mocked<Repository<HighlightEntity>>;
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

  const mockRecording: RecordingEntity = {
    id: 'recording-1',
    title: 'Test Recording',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as RecordingEntity;

  const mockHighlight: HighlightEntity = {
    id: 'highlight-1',
    title: 'Test Highlight',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as HighlightEntity;

  const mockUpload: CdnUploadEntity = {
    id: 'upload-1',
    recordingId: 'recording-1',
    uploadedBy: 'user-1',
    type: UploadType.RECORDING,
    provider: StorageProvider.AWS_S3,
    originalFileName: 'test.mp4',
    fileName: 'test-processed.mp4',
    filePath: '/uploads/test-processed.mp4',
    status: UploadStatus.PENDING,
    fileMetadata: {
      mimeType: 'video/mp4',
      size: 1048576,
    },
    uploadMetadata: {
      uploadId: 'upload-123',
      multipart: false,
    },
    processingMetadata: {
      processingSteps: [],
      transcodingEnabled: false,
      outputFormats: [],
      thumbnailGenerated: false,
      previewGenerated: false,
    },
    storageMetadata: {
      provider: StorageProvider.AWS_S3,
      bucket: 'rbx-streams',
      region: 'us-east-1',
      storageClass: 'STANDARD',
      backupEnabled: true,
      retentionPeriod: 30,
      accessControl: 'private',
    },
    analytics: {
      downloads: 0,
      views: 0,
      bandwidth: 0,
      avgDownloadSpeed: 0,
      popularRegions: [],
    },
    metadata: {
      tags: [],
      autoUploaded: true,
      publicAccess: false,
      allowedOrigins: [],
    },
    retryCount: 0,
    region: 'global',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as CdnUploadEntity;

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
        CdnUploadService,
        { provide: getRepositoryToken(CdnUploadEntity), useFactory: mockRepository },
        { provide: getRepositoryToken(RecordingEntity), useFactory: mockRepository },
        { provide: getRepositoryToken(HighlightEntity), useFactory: mockRepository },
        { provide: getRepositoryToken(UserEntity), useFactory: mockRepository },
        { provide: CacheService, useFactory: mockCacheService },
        { provide: NotificationService, useFactory: mockNotificationService },
        { provide: DataSource, useFactory: mockDataSource },
      ],
    }).compile();

    service = module.get<CdnUploadService>(CdnUploadService);
    uploadRepo = module.get(getRepositoryToken(CdnUploadEntity));
    recordingRepo = module.get(getRepositoryToken(RecordingEntity));
    highlightRepo = module.get(getRepositoryToken(HighlightEntity));
    userRepo = module.get(getRepositoryToken(UserEntity));
    cacheService = module.get(CacheService);
    notificationService = module.get(NotificationService);
    dataSource = module.get(DataSource);
  });

  describe('create', () => {
    it('should create an upload successfully with recording', async () => {
      const createInput = {
        recordingId: 'recording-1',
        uploadedBy: 'user-1',
        type: UploadType.RECORDING,
        provider: StorageProvider.AWS_S3,
        originalFileName: 'video.mp4',
        fileName: 'processed-video.mp4',
        filePath: 'streams/2024/01/processed-video.mp4',
        fileMetadata: {
          mimeType: 'video/mp4',
          size: 104857600,
        },
      } as any;

      userRepo.findOne.mockResolvedValue(mockUser);
      recordingRepo.findOne.mockResolvedValue(mockRecording);
      uploadRepo.create.mockReturnValue(mockUpload);
      uploadRepo.save.mockResolvedValue(mockUpload);
      cacheService.set.mockResolvedValue(undefined);
      notificationService.create.mockResolvedValue(undefined);

      const result = await service.create(createInput);

      expect(result).toEqual(mockUpload);
      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { id: 'user-1' } });
      expect(recordingRepo.findOne).toHaveBeenCalledWith({ where: { id: 'recording-1' } });
      expect(uploadRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...createInput,
          status: UploadStatus.PENDING,
          storageMetadata: expect.objectContaining({
            provider: StorageProvider.AWS_S3,
            bucket: 'rbx-streams',
            region: 'us-east-1',
          }),
        })
      );
      expect(cacheService.set).toHaveBeenCalledWith(
        'upload:upload-1',
        mockUpload,
        3600
      );
      expect(notificationService.create).toHaveBeenCalledWith({
        userId: 'user-1',
        templateKey: 'upload_created',
        channel: 'inApp',
        payload: expect.objectContaining({
          uploadId: 'upload-1',
          fileName: 'processed-video.mp4',
        }),
      });
    });

    it('should create an upload successfully with highlight', async () => {
      const createInput = {
        highlightId: 'highlight-1',
        uploadedBy: 'user-1',
        type: UploadType.RECORDING,
        provider: StorageProvider.AWS_S3,
        originalFileName: 'highlight.mp4',
        fileName: 'processed-highlight.mp4',
        filePath: 'highlights/2024/01/processed-highlight.mp4',
      } as any;

      userRepo.findOne.mockResolvedValue(mockUser);
      highlightRepo.findOne.mockResolvedValue(mockHighlight);
      uploadRepo.create.mockReturnValue(mockUpload);
      uploadRepo.save.mockResolvedValue(mockUpload);
      cacheService.set.mockResolvedValue(undefined);
      notificationService.create.mockResolvedValue(undefined);

      const result = await service.create(createInput);

      expect(result).toEqual(mockUpload);
      expect(highlightRepo.findOne).toHaveBeenCalledWith({ where: { id: 'highlight-1' } });
    });

    it('should throw NotFoundError if uploader not found', async () => {
      const createInput = {
        recordingId: 'recording-1',
        uploadedBy: 'invalid-user',
        type: UploadType.RECORDING,
        provider: StorageProvider.AWS_S3,
        originalFileName: 'video.mp4',
        fileName: 'processed-video.mp4',
        filePath: 'streams/2024/01/processed-video.mp4',
      } as any;

      userRepo.findOne.mockResolvedValue(null);

      await expect(service.create(createInput)).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError if neither recordingId nor highlightId provided', async () => {
      const createInput = {
        uploadedBy: 'user-1',
        type: UploadType.RECORDING,
        provider: StorageProvider.AWS_S3,
        originalFileName: 'video.mp4',
        fileName: 'processed-video.mp4',
        filePath: 'streams/2024/01/processed-video.mp4',
      } as any;

      userRepo.findOne.mockResolvedValue(mockUser);

      await expect(service.create(createInput)).rejects.toThrow(ValidationError);
    });
  });

  describe('startUpload', () => {
    it('should start upload successfully', async () => {
      const startedUpload = {
        ...mockUpload,
        status: UploadStatus.UPLOADING,
        uploadMetadata: {
          ...mockUpload.uploadMetadata,
          uploadStartedAt: new Date(),
        },
      } as any;

      cacheService.get.mockResolvedValue(mockUpload);
      uploadRepo.save.mockResolvedValue(startedUpload);
      cacheService.set.mockResolvedValue(undefined);
      notificationService.create.mockResolvedValue(undefined);

      const result = await service.startUpload('upload-1');

      expect(result).toEqual(startedUpload);
      expect(uploadRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: UploadStatus.UPLOADING,
          uploadMetadata: expect.objectContaining({
            uploadStartedAt: expect.any(Date),
          }),
        })
      );
      expect(notificationService.create).toHaveBeenCalledWith({
        userId: 'user-1',
        templateKey: 'upload_started',
        channel: 'inApp',
        payload: expect.objectContaining({
          uploadId: 'upload-1',
          startedAt: expect.any(Date),
        }),
      });
    });

    it('should throw NotFoundError if upload not found', async () => {
      cacheService.get.mockResolvedValue(null);
      uploadRepo.findOne.mockResolvedValue(null);

      await expect(service.startUpload('invalid-upload')).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError if upload is not pending', async () => {
      const uploadingUpload = { ...mockUpload, status: UploadStatus.UPLOADING } as any;
      cacheService.get.mockResolvedValue(uploadingUpload);

      await expect(service.startUpload('upload-1')).rejects.toThrow(ValidationError);
    });
  });

  describe('completeUpload', () => {
    it('should complete upload successfully', async () => {
      const uploadingUpload = { ...mockUpload, status: UploadStatus.UPLOADING } as any;
      const completedUpload = {
        ...uploadingUpload,
        status: UploadStatus.PROCESSING,
        cdnUrl: 'https://cdn.example.com/video.mp4',
        downloadUrl: 'https://cdn.example.com/video.mp4?download=1',
        embedUrl: 'https://cdn.example.com/embed/video.mp4',
        thumbnailUrl: 'https://cdn.example.com/thumbnail.jpg',
        previewUrl: 'https://cdn.example.com/preview.mp4',
        uploadMetadata: {
          ...uploadingUpload.uploadMetadata,
          uploadCompletedAt: new Date(),
          uploadDuration: 300, // 5 minutes
        },
        processingMetadata: {
          ...uploadingUpload.processingMetadata,
          processingSteps: [
            {
              step: 'post_processing',
              startedAt: new Date(),
              status: 'processing',
            },
          ],
        },
      } as any;

      cacheService.get.mockResolvedValue(uploadingUpload);
      uploadRepo.save.mockResolvedValue(completedUpload);
      cacheService.set.mockResolvedValue(undefined);

      const completionData = {
        cdnUrl: 'https://cdn.example.com/video.mp4',
        downloadUrl: 'https://cdn.example.com/video.mp4?download=1',
        embedUrl: 'https://cdn.example.com/embed/video.mp4',
        thumbnailUrl: 'https://cdn.example.com/thumbnail.jpg',
        previewUrl: 'https://cdn.example.com/preview.mp4',
      } as any;

      const result = await service.completeUpload('upload-1', completionData);

      expect(result).toEqual(completedUpload);
      expect(uploadRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: UploadStatus.PROCESSING,
          cdnUrl: completionData.cdnUrl,
          downloadUrl: completionData.downloadUrl,
          embedUrl: completionData.embedUrl,
          thumbnailUrl: completionData.thumbnailUrl,
          previewUrl: completionData.previewUrl,
        })
      );
    });

    it('should throw ValidationError if upload is not uploading', async () => {
      cacheService.get.mockResolvedValue(mockUpload);

      await expect(service.completeUpload('upload-1', {} as any)).rejects.toThrow(ValidationError);
    });
  });

  describe('finalizeUpload', () => {
    it('should finalize upload successfully', async () => {
      const processingUpload = { ...mockUpload, status: UploadStatus.PROCESSING } as any;
      const finalizedUpload = {
        ...processingUpload,
        status: UploadStatus.COMPLETED,
        processingMetadata: {
          ...processingUpload.processingMetadata,
          processingCompletedAt: new Date(),
          processingSteps: [
            {
              step: 'post_processing',
              startedAt: new Date(),
              completedAt: new Date(),
              status: 'completed',
            },
          ],
        },
      } as any;

      cacheService.get.mockResolvedValue(processingUpload);
      uploadRepo.save.mockResolvedValue(finalizedUpload);
      cacheService.set.mockResolvedValue(undefined);
      notificationService.create.mockResolvedValue(undefined);

      const result = await service.finalizeUpload('upload-1');

      expect(result).toEqual(finalizedUpload);
      expect(uploadRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: UploadStatus.COMPLETED,
          processingMetadata: expect.objectContaining({
            processingCompletedAt: expect.any(Date),
          }),
        })
      );
      expect(notificationService.create).toHaveBeenCalledWith({
        userId: 'user-1',
        templateKey: 'upload_completed',
        channel: 'inApp',
        payload: expect.objectContaining({
          uploadId: 'upload-1',
          cdnUrl: finalizedUpload.cdnUrl,
        }),
      });
    });

    it('should throw ValidationError if upload is not processing', async () => {
      cacheService.get.mockResolvedValue(mockUpload);

      await expect(service.finalizeUpload('upload-1')).rejects.toThrow(ValidationError);
    });
  });

  describe('failUpload', () => {
    it('should fail upload successfully', async () => {
      const uploadingUpload = { ...mockUpload, status: UploadStatus.UPLOADING } as any;
      const failedUpload = {
        ...uploadingUpload,
        status: UploadStatus.FAILED,
        errorMessage: 'Upload timeout',
        uploadMetadata: {
          ...uploadingUpload.uploadMetadata,
          lastRetryAt: new Date(),
          retryCount: 1,
        },
        processingMetadata: {
          ...uploadingUpload.processingMetadata,
          processingCompletedAt: new Date(),
          processingSteps: [
            {
              step: 'post_processing',
              startedAt: new Date(),
              completedAt: new Date(),
              status: 'failed',
              error: 'Upload timeout',
            },
          ],
        },
      } as any;

      cacheService.get.mockResolvedValue(uploadingUpload);
      uploadRepo.save.mockResolvedValue(failedUpload);
      cacheService.set.mockResolvedValue(undefined);
      notificationService.create.mockResolvedValue(undefined);

      const result = await service.failUpload('upload-1', 'Upload timeout');

      expect(result).toEqual(failedUpload);
      expect(uploadRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: UploadStatus.FAILED,
          errorMessage: 'Upload timeout',
        })
      );
      expect(notificationService.create).toHaveBeenCalledWith({
        userId: 'user-1',
        templateKey: 'upload_failed',
        channel: 'inApp',
        payload: expect.objectContaining({
          uploadId: 'upload-1',
          errorMessage: 'Upload timeout',
        }),
      });
    });
  });

  describe('generateSignedUrl', () => {
    it('should generate signed URL successfully', async () => {
      const completedUpload = { ...mockUpload, status: UploadStatus.COMPLETED, cdnUrl: 'https://cdn.example.com/video.mp4' } as any;
      const uploadWithSignedUrl = {
        ...completedUpload,
        signedUrl: 'https://cdn.example.com/video.mp4?expires=1234567890&signature=mock-signature',
        signedUrlExpiry: new Date(Date.now() + 3600000), // 1 hour from now
      } as any;

      cacheService.get.mockResolvedValue(completedUpload);
      uploadRepo.save.mockResolvedValue(uploadWithSignedUrl);
      cacheService.set.mockResolvedValue(undefined);

      const result = await service.generateSignedUrl('upload-1', 60);

      expect(result).toBe(uploadWithSignedUrl.signedUrl);
      expect(uploadRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          signedUrl: expect.any(String),
          signedUrlExpiry: expect.any(Date),
        })
      );
    });

    it('should throw ValidationError if upload is not completed', async () => {
      cacheService.get.mockResolvedValue(mockUpload);

      await expect(service.generateSignedUrl('upload-1')).rejects.toThrow(ValidationError);
    });
  });

  describe('updateAnalytics', () => {
    it('should update analytics successfully', async () => {
      const analyticsData = {
        downloads: 50,
        views: 200,
        bandwidth: 1048576000, // 1GB
        avgDownloadSpeed: 1048576, // 1MB/s
        popularRegions: [
          { region: 'us-east-1', requests: 100 },
          { region: 'eu-west-1', requests: 50 },
        ],
      } as any;

      cacheService.get.mockResolvedValue(mockUpload);
      uploadRepo.save.mockResolvedValue(mockUpload);
      cacheService.set.mockResolvedValue(undefined);

      await service.updateAnalytics('upload-1', analyticsData);

      expect(uploadRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          analytics: expect.objectContaining(analyticsData),
        })
      );
    });
  });

  describe('findMany', () => {
    it('should return paginated uploads', async () => {
      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockUpload], 1]),
      } as any;

      uploadRepo.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.findMany({
        uploadedBy: 'user-1',
        status: UploadStatus.COMPLETED,
        limit: 10,
        offset: 0,
      });

      expect(result).toEqual({
        uploads: [mockUpload],
        total: 1,
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('upload.uploadedBy = :uploadedBy', {
        uploadedBy: 'user-1',
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('upload.status = :status', {
        status: UploadStatus.COMPLETED,
      });
    });
  });

  describe('getUploadsByRecording', () => {
    it('should return cached uploads by recording', async () => {
      const recordingUploads = [mockUpload];
      cacheService.get.mockResolvedValue(recordingUploads);

      const result = await service.getUploadsByRecording('recording-1');

      expect(result).toEqual(recordingUploads);
      expect(uploadRepo.find).not.toHaveBeenCalled();
    });

    it('should fetch uploads by recording from database', async () => {
      const recordingUploads = [mockUpload];
      cacheService.get.mockResolvedValue(null);
      uploadRepo.find.mockResolvedValue(recordingUploads);
      cacheService.set.mockResolvedValue(undefined);

      const result = await service.getUploadsByRecording('recording-1');

      expect(result).toEqual(recordingUploads);
      expect(uploadRepo.find).toHaveBeenCalledWith({
        where: { recordingId: 'recording-1' },
        relations: ['uploader'],
        order: { createdAt: 'DESC' },
      });
      expect(cacheService.set).toHaveBeenCalledWith(
        'uploads_recording:recording-1',
        recordingUploads,
        300
      );
    });
  });

  describe('getUploadStats', () => {
    it('should return upload statistics', async () => {
      const uploads = [
        {
          ...mockUpload,
          status: UploadStatus.COMPLETED,
          fileMetadata: { size: 104857600 }, // 100MB
          analytics: { bandwidth: 1048576000 }, // 1GB
          uploadMetadata: { avgUploadSpeed: 1048576 }, // 1MB/s
        },
        {
          ...mockUpload,
          status: UploadStatus.FAILED,
          fileMetadata: { size: 0 },
          analytics: { bandwidth: 0 },
          uploadMetadata: { avgUploadSpeed: 0 },
        },
      ];
      uploadRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(uploads),
      } as any);

      const result = await service.getUploadStats('user-1');

      expect(result).toEqual({
        totalUploads: 2,
        totalSize: 104857600,
        completedUploads: 1,
        failedUploads: 1,
        totalBandwidth: 1048576000,
        avgUploadSpeed: 1048576,
      });
    });

    it('should return zero stats for user with no uploads', async () => {
      uploadRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      } as any);

      const result = await service.getUploadStats('user-1');

      expect(result).toEqual({
        totalUploads: 0,
        totalSize: 0,
        completedUploads: 0,
        failedUploads: 0,
        totalBandwidth: 0,
        avgUploadSpeed: 0,
      });
    });
  });
});
