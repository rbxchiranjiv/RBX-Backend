import { Test, TestingModule } from '@nestjs/testing';
import { Repository, DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StreamWebhookService } from '../stream-webhook.service';
import { CacheService } from '../cache.service';
import { NotificationService } from '../notification.service';
import { StreamWebhookEntity, WebhookType, WebhookStatus, WebhookProvider } from '../../database/entities/stream-webhook.entity';
import { StreamSessionEntity } from '../../database/entities/stream-session.entity';
import { RecordingEntity } from '../../database/entities/recording.entity';
import { HighlightEntity } from '../../database/entities/highlight.entity';
import { CdnUploadEntity } from '../../database/entities/cdn-upload.entity';
import { NotFoundError, ValidationError } from '../errors';

describe.skip('StreamWebhookService', () => {
  let service: StreamWebhookService;
  let webhookRepo: jest.Mocked<Repository<StreamWebhookEntity>>;
  let streamSessionRepo: jest.Mocked<Repository<StreamSessionEntity>>;
  let recordingRepo: jest.Mocked<Repository<RecordingEntity>>;
  let highlightRepo: jest.Mocked<Repository<HighlightEntity>>;
  let uploadRepo: jest.Mocked<Repository<CdnUploadEntity>>;
  let cacheService: jest.Mocked<CacheService>;
  let notificationService: jest.Mocked<NotificationService>;
  let dataSource: jest.Mocked<DataSource>;

  const mockStreamSession: StreamSessionEntity = {
    id: 'stream-1',
    title: 'Test Stream',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as StreamSessionEntity;

  const mockRecording: RecordingEntity = {
    id: 'recording-1',
    title: 'Test Recording',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as RecordingEntity;

  const mockHighlight: HighlightEntity = {
    id: 'highlight-1',
    title: 'Test Highlight',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as HighlightEntity;

  const mockUpload: CdnUploadEntity = {
    id: 'upload-1',
    originalFileName: 'video.mp4',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as CdnUploadEntity;

  const mockWebhook: StreamWebhookEntity = {
    id: 'webhook-1',
    streamSessionId: 'stream-1',
    type: WebhookType.STREAM_START,
    provider: WebhookProvider.CUSTOM,
    endpoint: 'https://api.example.com/webhook',
    payload: { streamId: 'stream-1', status: 'started' },
    status: WebhookStatus.PENDING,
    headers: {},
    response: {},
    processingMetadata: {
      attempts: 0,
      maxAttempts: 3,
      retryDelay: 60,
      processingStartedAt: new Date(),
    },
    metadata: {
      priority: 0,
      timeout: 30,
      retryStrategy: 'exponential',
      tags: [],
    },
    region: 'global',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as StreamWebhookEntity;

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
        StreamWebhookService,
        { provide: getRepositoryToken(StreamWebhookEntity), useFactory: mockRepository },
        { provide: getRepositoryToken(StreamSessionEntity), useFactory: mockRepository },
        { provide: getRepositoryToken(RecordingEntity), useFactory: mockRepository },
        { provide: getRepositoryToken(HighlightEntity), useFactory: mockRepository },
        { provide: getRepositoryToken(CdnUploadEntity), useFactory: mockRepository },
        { provide: CacheService, useFactory: mockCacheService },
        { provide: NotificationService, useFactory: mockNotificationService },
        { provide: DataSource, useFactory: mockDataSource },
      ],
    }).compile();

    service = module.get<StreamWebhookService>(StreamWebhookService);
    webhookRepo = module.get(getRepositoryToken(StreamWebhookEntity));
    streamSessionRepo = module.get(getRepositoryToken(StreamSessionEntity));
    recordingRepo = module.get(getRepositoryToken(RecordingEntity));
    highlightRepo = module.get(getRepositoryToken(HighlightEntity));
    uploadRepo = module.get(getRepositoryToken(CdnUploadEntity));
    cacheService = module.get(CacheService);
    notificationService = module.get(NotificationService);
    dataSource = module.get(DataSource);
  });

  describe('create', () => {
    it('should create a webhook successfully with stream session', async () => {
      const createInput = {
        streamSessionId: 'stream-1',
        type: WebhookType.STREAM_START,
        provider: WebhookProvider.CUSTOM,
        endpoint: 'https://api.example.com/webhook',
        payload: { streamId: 'stream-1', status: 'started' },
      };

      streamSessionRepo.findOne.mockResolvedValue(mockStreamSession);
      webhookRepo.create.mockReturnValue(mockWebhook);
      webhookRepo.save.mockResolvedValue(mockWebhook);
      cacheService.set.mockReturnValue(undefined);

      const result = await service.create(createInput);

      expect(result).toEqual(mockWebhook);
      expect(streamSessionRepo.findOne).toHaveBeenCalledWith({ where: { id: 'stream-1' } });
      expect(webhookRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...createInput,
          status: WebhookStatus.PENDING,
          headers: {},
          response: {},
        })
      );
      expect(cacheService.set).toHaveBeenCalledWith(
        'webhook:webhook-1',
        mockWebhook,
        3600
      );
    });

    it('should create a webhook successfully with recording', async () => {
      const createInput = {
        recordingId: 'recording-1',
        type: WebhookType.RECORDING_READY,
        provider: WebhookProvider.CUSTOM,
        endpoint: 'https://api.example.com/webhook',
        payload: { recordingId: 'recording-1', status: 'completed' },
      };

      recordingRepo.findOne.mockResolvedValue(mockRecording);
      webhookRepo.create.mockReturnValue(mockWebhook);
      webhookRepo.save.mockResolvedValue(mockWebhook);
      cacheService.set.mockReturnValue(undefined);

      const result = await service.create(createInput);

      expect(result).toEqual(mockWebhook);
      expect(recordingRepo.findOne).toHaveBeenCalledWith({ where: { id: 'recording-1' } });
    });

    it('should throw NotFoundError if stream session not found', async () => {
      const createInput = {
        streamSessionId: 'invalid-stream',
        type: WebhookType.STREAM_START,
        provider: WebhookProvider.CUSTOM,
        endpoint: 'https://api.example.com/webhook',
        payload: { streamId: 'invalid-stream', status: 'started' },
      };

      streamSessionRepo.findOne.mockResolvedValue(null);

      await expect(service.create(createInput)).rejects.toThrow(NotFoundError);
    });
  });

  describe('deliverWebhook', () => {
    it('should deliver webhook successfully', async () => {
      const deliveredWebhook = {
        ...mockWebhook,
        status: WebhookStatus.COMPLETED,
        deliveredAt: new Date(),
        response: {
          statusCode: 200,
          body: JSON.stringify({ success: true }),
          duration: 150,
        },
      };

      cacheService.get.mockReturnValue(mockWebhook);
      webhookRepo.save.mockResolvedValue(deliveredWebhook);
      cacheService.set.mockReturnValue(undefined);

      // Mock the HTTP request
      jest.spyOn(service as any, 'sendHttpRequest').mockResolvedValue({
        success: true,
        statusCode: 200,
        body: JSON.stringify({ success: true }),
        duration: 150,
      });

      const result = await service.deliverWebhook('webhook-1');

      expect(result).toEqual({
        success: true,
        statusCode: 200,
        response: { success: true },
        duration: 150,
      });
      expect(webhookRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: WebhookStatus.COMPLETED,
          deliveredAt: expect.any(Date),
          response: expect.objectContaining({
            statusCode: 200,
            body: JSON.stringify({ success: true }),
            duration: 150,
          }),
        })
      );
    });

    it('should schedule retry on failed delivery', async () => {
      const retryingWebhook = {
        ...mockWebhook,
        status: WebhookStatus.RETRYING,
        processingMetadata: {
          ...mockWebhook.processingMetadata,
          attempts: 1,
          nextRetryAt: new Date(Date.now() + 60000), // 1 minute from now
        },
      };

      cacheService.get.mockReturnValue(mockWebhook);
      webhookRepo.save.mockResolvedValue(retryingWebhook);
      cacheService.set.mockReturnValue(undefined);

      // Mock the HTTP request failure
      jest.spyOn(service as any, 'sendHttpRequest').mockResolvedValue({
        success: false,
        statusCode: 500,
        body: JSON.stringify({ error: 'Internal server error' }),
        error: 'Internal server error',
        duration: 200,
      });

      const result = await service.deliverWebhook('webhook-1');

      expect(result).toEqual({
        success: false,
        statusCode: 500,
        response: { error: 'Internal server error' },
        error: 'Internal server error',
        duration: 200,
      });
      expect(webhookRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: WebhookStatus.RETRYING,
          processingMetadata: expect.objectContaining({
            attempts: 1,
            nextRetryAt: expect.any(Date),
          }),
        })
      );
    });

    it('should fail webhook if max attempts reached', async () => {
      const failedWebhook = {
        ...mockWebhook,
        status: WebhookStatus.FAILED,
        errorMessage: 'Maximum retry attempts reached',
        processingMetadata: {
          ...mockWebhook.processingMetadata,
          attempts: 3,
          maxAttempts: 3,
        },
      };

      cacheService.get.mockReturnValue(mockWebhook);
      webhookRepo.save.mockResolvedValue(failedWebhook);
      cacheService.set.mockReturnValue(undefined);

      const result = await service.deliverWebhook('webhook-1');

      expect(result).toEqual({
        success: false,
        error: 'Maximum retry attempts reached',
      });
      expect(webhookRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: WebhookStatus.FAILED,
          errorMessage: 'Maximum retry attempts reached',
        })
      );
    });

    it('should throw NotFoundError if webhook not found', async () => {
      cacheService.get.mockReturnValue(null);
      webhookRepo.findOne.mockResolvedValue(null);

      await expect(service.deliverWebhook('invalid-webhook')).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError if webhook is not deliverable', async () => {
      const completedWebhook = { ...mockWebhook, status: WebhookStatus.COMPLETED };
      cacheService.get.mockReturnValue(completedWebhook);

      await expect(service.deliverWebhook('webhook-1')).rejects.toThrow(ValidationError);
    });
  });

  describe('retryWebhook', () => {
    it('should retry failed webhook successfully', async () => {
      const failedWebhook = { ...mockWebhook, status: WebhookStatus.FAILED };
      const retryingWebhook = {
        ...failedWebhook,
        status: WebhookStatus.RETRYING,
        processingMetadata: {
          ...failedWebhook.processingMetadata,
          attempts: 0,
        },
      };

      cacheService.get.mockReturnValue(failedWebhook);
      webhookRepo.save.mockResolvedValue(retryingWebhook);
      cacheService.set.mockReturnValue(undefined);

      // Mock the HTTP request
      jest.spyOn(service as any, 'sendHttpRequest').mockResolvedValue({
        success: true,
        statusCode: 200,
        body: JSON.stringify({ success: true }),
        duration: 150,
      });

      const result = await service.retryWebhook('webhook-1');

      expect(result).toEqual({
        success: true,
        statusCode: 200,
        response: { success: true },
        duration: 150,
      });
      expect(webhookRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: WebhookStatus.RETRYING,
          processingMetadata: expect.objectContaining({
            attempts: 0,
          }),
        })
      );
    });

    it('should throw ValidationError if webhook is not failed', async () => {
      cacheService.get.mockReturnValue(mockWebhook);

      await expect(service.retryWebhook('webhook-1')).rejects.toThrow(ValidationError);
    });
  });

  describe('failWebhook', () => {
    it('should fail webhook successfully', async () => {
      const failedWebhook = {
        ...mockWebhook,
        status: WebhookStatus.FAILED,
        errorMessage: 'Webhook delivery failed',
        processingMetadata: {
          ...mockWebhook.processingMetadata,
          processingCompletedAt: new Date(),
        },
      };

      cacheService.get.mockReturnValue(mockWebhook);
      webhookRepo.save.mockResolvedValue(failedWebhook);
      cacheService.set.mockReturnValue(undefined);

      const result = await service.failWebhook('webhook-1', 'Webhook delivery failed');

      expect(result).toEqual(failedWebhook);
      expect(webhookRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: WebhookStatus.FAILED,
          errorMessage: 'Webhook delivery failed',
          processingMetadata: expect.objectContaining({
            processingCompletedAt: expect.any(Date),
          }),
        })
      );
    });
  });

  describe('findMany', () => {
    it('should return paginated webhooks', async () => {
      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockWebhook], 1]),
      } as any;

      webhookRepo.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.findMany({
        streamSessionId: 'stream-1',
        status: WebhookStatus.PENDING,
        limit: 10,
        offset: 0,
      });

      expect(result).toEqual({
        webhooks: [mockWebhook],
        total: 1,
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('webhook.streamSessionId = :streamSessionId', {
        streamSessionId: 'stream-1',
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('webhook.status = :status', {
        status: WebhookStatus.PENDING,
      });
    });
  });

  describe('getWebhooksByStream', () => {
    it('should return cached webhooks by stream', async () => {
      const streamWebhooks = [mockWebhook];
      cacheService.get.mockReturnValue(streamWebhooks);

      const result = await service.getWebhooksByStream('stream-1');

      expect(result).toEqual(streamWebhooks);
      expect(webhookRepo.find).not.toHaveBeenCalled();
    });

    it('should fetch webhooks by stream from database', async () => {
      const streamWebhooks = [mockWebhook];
      cacheService.get.mockReturnValue(null);
      webhookRepo.find.mockResolvedValue(streamWebhooks);
      cacheService.set.mockReturnValue(undefined);

      const result = await service.getWebhooksByStream('stream-1');

      expect(result).toEqual(streamWebhooks);
      expect(webhookRepo.find).toHaveBeenCalledWith({
        where: { streamSessionId: 'stream-1' },
        order: { createdAt: 'DESC' },
      });
      expect(cacheService.set).toHaveBeenCalledWith(
        'webhooks_stream:stream-1',
        streamWebhooks,
        300
      );
    });
  });

  describe('getPendingWebhooks', () => {
    it('should return cached pending webhooks', async () => {
      const pendingWebhooks = [mockWebhook];
      cacheService.get.mockReturnValue(pendingWebhooks);

      const result = await service.getPendingWebhooks();

      expect(result).toEqual(pendingWebhooks);
      expect(webhookRepo.find).not.toHaveBeenCalled();
    });

    it('should fetch pending webhooks from database', async () => {
      const pendingWebhooks = [mockWebhook];
      cacheService.get.mockReturnValue(null);
      webhookRepo.find.mockResolvedValue(pendingWebhooks);
      cacheService.set.mockReturnValue(undefined);

      const result = await service.getPendingWebhooks();

      expect(result).toEqual(pendingWebhooks);
      expect(webhookRepo.find).toHaveBeenCalledWith({
        where: expect.any(Object),
        order: {
          'metadata.priority': 'DESC',
          createdAt: 'ASC',
        },
      });
      expect(cacheService.set).toHaveBeenCalledWith('pending_webhooks', pendingWebhooks, 120);
    });
  });

  describe('getWebhookStats', () => {
    it('should return webhook statistics', async () => {
      const webhooks = [
        { ...mockWebhook, status: WebhookStatus.COMPLETED, response: { duration: 150 } },
        { ...mockWebhook, status: WebhookStatus.FAILED },
        { ...mockWebhook, status: WebhookStatus.PENDING },
      ];
      webhookRepo.find.mockResolvedValue(webhooks);

      const result = await service.getWebhookStats();

      expect(result).toEqual({
        totalWebhooks: 3,
        completedWebhooks: 1,
        failedWebhooks: 1,
        pendingWebhooks: 1,
        avgDeliveryTime: 150,
        successRate: 33.333333333333336, // 1/3 * 100
      });
    });

    it('should return zero stats for no webhooks', async () => {
      webhookRepo.find.mockResolvedValue([]);

      const result = await service.getWebhookStats();

      expect(result).toEqual({
        totalWebhooks: 0,
        completedWebhooks: 0,
        failedWebhooks: 0,
        pendingWebhooks: 0,
        avgDeliveryTime: 0,
        successRate: 0,
      });
    });
  });

  describe('private methods', () => {
    describe('calculateRetryDelay', () => {
      it('should calculate linear retry delay', () => {
        const serviceInstance = service as any;
        const delay = serviceInstance.calculateRetryDelay(2, 60, 'linear');
        expect(delay).toBe(120); // 60 * 2
      });

      it('should calculate exponential retry delay', () => {
        const serviceInstance = service as any;
        const delay = serviceInstance.calculateRetryDelay(3, 60, 'exponential');
        expect(delay).toBe(240); // 60 * 2^(3-1)
      });

      it('should calculate fixed retry delay', () => {
        const serviceInstance = service as any;
        const delay = serviceInstance.calculateRetryDelay(5, 60, 'fixed');
        expect(delay).toBe(60); // Always 60
      });
    });

    describe('generateWebhookSignature', () => {
      it('should generate webhook signature', () => {
        const serviceInstance = service as any;
        const webhook = {
          id: 'webhook-1',
          type: 'stream_start',
          payload: { streamId: 'stream-1' },
        };
        const signature = serviceInstance.generateWebhookSignature(webhook, 'secret-key');
        expect(signature).toBe('sha256='); // Base64 encoded string starts with 'sha256='
      });
    });

    describe('prepareWebhookPayload', () => {
      it('should prepare webhook payload', () => {
        const serviceInstance = service as any;
        const webhook = {
          id: 'webhook-1',
          type: 'stream_start',
          provider: 'custom',
          event_id: 'event-123',
          payload: { streamId: 'stream-1' },
          streamSessionId: 'stream-1',
        };
        const payload = serviceInstance.prepareWebhookPayload(webhook);
        expect(payload).toEqual({
          id: 'webhook-1',
          type: 'stream_start',
          provider: 'custom',
          event_id: 'event-123',
          timestamp: expect.any(String),
          payload: { streamId: 'stream-1' },
          stream_session_id: 'stream-1',
        });
      });
    });

    describe('prepareWebhookHeaders', () => {
      it('should prepare webhook headers without signature', () => {
        const serviceInstance = service as any;
        const webhook = {
          id: 'webhook-1',
          type: 'stream_start',
          provider: 'custom',
          headers: { 'X-Custom': 'value' },
        };
        const headers = serviceInstance.prepareWebhookHeaders(webhook);
        expect(headers).toEqual({
          'Content-Type': 'application/json',
          'User-Agent': 'RBX-Webhook-Service/1.0',
          'X-Webhook-ID': 'webhook-1',
          'X-Webhook-Type': 'stream_start',
          'X-Webhook-Provider': 'custom',
          'X-Custom': 'value',
        });
      });

      it('should prepare webhook headers with signature', () => {
        const serviceInstance = service as any;
        const webhook = {
          id: 'webhook-1',
          type: 'stream_start',
          provider: 'custom',
          metadata: { webhookSecret: 'secret-key' },
        };
        jest.spyOn(serviceInstance, 'generateWebhookSignature').mockReturnValue('sha256=signature');
        const headers = serviceInstance.prepareWebhookHeaders(webhook);
        expect(headers).toEqual({
          'Content-Type': 'application/json',
          'User-Agent': 'RBX-Webhook-Service/1.0',
          'X-Webhook-ID': 'webhook-1',
          'X-Webhook-Type': 'stream_start',
          'X-Webhook-Provider': 'custom',
          'X-Webhook-Signature': 'sha256=signature',
        });
      });
    });
  });
});
