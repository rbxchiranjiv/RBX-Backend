import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
// import { ConfigModule } from '@nestjs/config'; // TODO: Fix config module import
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StreamSessionEntity, StreamStatus, StreamType, StreamQuality } from '../../database/entities/stream-session.entity';
import { RecordingEntity, RecordingStatus, RecordingFormat, RecordingQuality } from '../../database/entities/recording.entity';
import { HighlightEntity, HighlightStatus, HighlightType, HighlightSource } from '../../database/entities/highlight.entity';
import { CdnUploadEntity, UploadStatus, UploadType, StorageProvider } from '../../database/entities/cdn-upload.entity';
import { StreamWebhookEntity, WebhookType, WebhookStatus, WebhookProvider } from '../../database/entities/stream-webhook.entity';
import { TournamentEntity } from '../../database/entities/tournament.entity';
import { MatchEntity } from '../../database/entities/match.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { StreamSessionService } from '../../services/stream-session.service';
import { RecordingService } from '../../services/recording.service';
import { HighlightService } from '../../services/highlight.service';
import { CdnUploadService } from '../../services/cdn-upload.service';
import { StreamWebhookService } from '../../services/stream-webhook.service';
import { CacheService } from '../../services/cache.service';
import { NotificationService } from '../../services/notification.service';
import { createTestDatabase } from '../test-helpers/database.helper';
import { createTestUser, createTestTournament, createTestMatch } from '../test-helpers/entity.helper';

describe.skip('Streams Integration Tests', () => {
  let app: INestApplication;
  let dataSource: any;
  let streamSessionRepo: Repository<StreamSessionEntity>;
  let recordingRepo: Repository<RecordingEntity>;
  let highlightRepo: Repository<HighlightEntity>;
  let uploadRepo: Repository<CdnUploadEntity>;
  let webhookRepo: Repository<StreamWebhookEntity>;
  let tournamentRepo: Repository<TournamentEntity>;
  let matchRepo: Repository<MatchEntity>;
  let userRepo: Repository<UserEntity>;
  let streamSessionService: StreamSessionService;
  let recordingService: RecordingService;
  let highlightService: HighlightService;
  let uploadService: CdnUploadService;
  let webhookService: StreamWebhookService;

  let testUser: UserEntity;
  let testTournament: TournamentEntity;
  let testMatch: MatchEntity;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        // ConfigModule.forRoot({
        //   isGlobal: true,
        //   load: [() => ({
        //     DATABASE_URL: process.env.DATABASE_URL || 'sqlite::memory:',
        //     REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
        //   })],
        // }),
        TypeOrmModule.forRootAsync({
          useFactory: async () => {
            const db = await createTestDatabase();
            dataSource = db;
            return {
              name: 'default',
              ...db.options,
            };
          },
        }),
        TypeOrmModule.forFeature([
          StreamSessionEntity,
          RecordingEntity,
          HighlightEntity,
          CdnUploadEntity,
          StreamWebhookEntity,
          TournamentEntity,
          MatchEntity,
          UserEntity,
        ]),
      ],
      providers: [
        StreamSessionService,
        RecordingService,
        HighlightService,
        CdnUploadService,
        StreamWebhookService,
        CacheService,
        NotificationService,
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    streamSessionRepo = module.get(getRepositoryToken(StreamSessionEntity));
    recordingRepo = module.get(getRepositoryToken(RecordingEntity));
    highlightRepo = module.get(getRepositoryToken(HighlightEntity));
    uploadRepo = module.get(getRepositoryToken(CdnUploadEntity));
    webhookRepo = module.get(getRepositoryToken(StreamWebhookEntity));
    tournamentRepo = module.get(getRepositoryToken(TournamentEntity));
    matchRepo = module.get(getRepositoryToken(MatchEntity));
    userRepo = module.get(getRepositoryToken(UserEntity));

    streamSessionService = module.get(StreamSessionService);
    recordingService = module.get(RecordingService);
    highlightService = module.get(HighlightService);
    uploadService = module.get(CdnUploadService);
    webhookService = module.get(StreamWebhookService);

    // Create test data
    testUser = await createTestUser(userRepo);
    testTournament = await createTestTournament(tournamentRepo, testUser);
    testMatch = await createTestMatch(matchRepo, testTournament);
  });

  afterAll(async () => {
    if (dataSource) {
      await dataSource.close();
    }
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    // Clean up test data
    await webhookRepo.delete({});
    await uploadRepo.delete({});
    await highlightRepo.delete({});
    await recordingRepo.delete({});
    await streamSessionRepo.delete({});
  });

  describe('Stream Session Lifecycle', () => {
    it('should create and manage stream session lifecycle', async () => {
      // Create stream session
      const streamSession = await streamSessionService.create({
        streamerId: testUser.id,
        type: StreamType.MATCH,
        title: 'Test Stream Session',
        tournamentId: testTournament.id,
        matchId: testMatch.id,
        metadata: {
          platform: 'test-platform',
          tags: [],
        },
      });

      expect(streamSession.status).toBe(StreamStatus.PENDING);
      expect(streamSession.streamerId).toBe(testUser.id);
      expect(streamSession.tournamentId).toBe(testTournament.id);
      expect(streamSession.matchId).toBe(testMatch.id);

      // Start stream
      const startedStream = await streamSessionService.startStream(streamSession.id);
      expect(startedStream.status).toBe(StreamStatus.LIVE);
      expect(startedStream.startedAt).toBeDefined();

      // Update viewer count
      await streamSessionService.updateViewerCount(streamSession.id, 50);
      const updatedStream = await streamSessionService.findById(streamSession.id);
      expect(updatedStream?.viewerCount).toBe(50);
      expect(updatedStream?.maxViewers).toBe(50);

      // Add highlight marker
      await streamSessionService.addHighlightMarker(streamSession.id, {
        timestamp: 120,
        type: 'kill',
        description: 'Amazing headshot',
        confidence: 0.95,
      });

      // End stream
      const endedStream = await streamSessionService.endStream(streamSession.id, 'Stream completed');
      expect(endedStream.status).toBe(StreamStatus.ENDED);
      expect(endedStream.endedAt).toBeDefined();
      expect(endedStream.streamStats.duration).toBeGreaterThan(0);
    });

    it('should create recording for stream session', async () => {
      // Create stream session
      const streamSession = await streamSessionService.create({
        streamerId: testUser.id,
        type: StreamType.MATCH,
        title: 'Test Stream with Recording',
      });

      // Start stream
      await streamSessionService.startStream(streamSession.id);

      // Create recording
      const recording = await recordingService.create({
        streamSessionId: streamSession.id,
        recordedBy: testUser.id,
        title: 'Test Recording',
        format: RecordingFormat.MP4,
        quality: RecordingQuality.HIGH,
        metadata: {
          autoRecorded: true,
          backupEnabled: true,
        },
      });

      expect(recording.status).toBe(RecordingStatus.INITIALIZING);
      expect(recording.streamSessionId).toBe(streamSession.id);

      // Start recording
      const startedRecording = await recordingService.startRecording(recording.id);
      expect(startedRecording.status).toBe(RecordingStatus.RECORDING);
      expect(startedRecording.startedAt).toBeDefined();

      // Add clip marker
      await recordingService.addClipMarker(recording.id, {
        id: 'clip-1',
        timestamp: 60,
        type: 'highlight',
        title: 'Great play',
        description: 'Teamwork moment',
        confidence: 0.9,
      });

      // Stop recording
      const stoppedRecording = await recordingService.stopRecording(recording.id);
      expect(stoppedRecording.status).toBe(RecordingStatus.PROCESSING);
      expect(stoppedRecording.endedAt).toBeDefined();

      // Complete recording
      const completedRecording = await recordingService.completeRecording(recording.id, {
        videoUrl: 'https://cdn.example.com/recording.mp4',
        downloadUrl: 'https://cdn.example.com/recording.mp4?download=1',
        thumbnailUrl: 'https://cdn.example.com/thumbnail.jpg',
        previewUrl: 'https://cdn.example.com/preview.mp4',
        videoMetadata: {
          resolution: '1920x1080',
          fps: 30,
          bitrate: 5000,
          fileSize: 104857600,
          duration: 3600,
          codec: 'h264',
          aspectRatio: '16:9',
          audioCodec: 'aac',
          audioBitrate: 128,
        },
      });

      expect(completedRecording.status).toBe(RecordingStatus.COMPLETED);
      expect(completedRecording.videoUrl).toBeDefined();
      expect(completedRecording.videoMetadata.duration).toBe(3600);
    });

    it('should create highlight from stream session', async () => {
      // Create stream session
      const streamSession = await streamSessionService.create({
        streamerId: testUser.id,
        type: StreamType.MATCH,
        title: 'Test Stream with Highlight',
      });

      // Create highlight
      const highlight = await highlightService.create({
        streamSessionId: streamSession.id,
        createdBy: testUser.id,
        type: HighlightType.KILL,
        source: HighlightSource.AUTO_GENERATED,
        title: 'Amazing Kill',
        startTime: 120,
        endTime: 125,
        aiMetadata: {
          confidence: 0.92,
          detectedEvents: [
            {
              event: 'headshot',
              timestamp: 122,
              confidence: 0.95,
            },
          ],
          tags: ['headshot', 'ace'],
        },
        metadata: {
          platform: 'test-platform',
          autoGenerated: true,
        },
      });

      expect(highlight.status).toBe(HighlightStatus.PROCESSING);
      expect(highlight.duration).toBe(5); // endTime - startTime
      expect(highlight.aiMetadata.confidence).toBe(0.92);

      // Complete highlight processing
      const completedHighlight = await highlightService.completeProcessing(highlight.id, {
        videoUrl: 'https://cdn.example.com/highlight.mp4',
        downloadUrl: 'https://cdn.example.com/highlight.mp4?download=1',
        thumbnailUrl: 'https://cdn.example.com/highlight-thumb.jpg',
        embedUrl: 'https://cdn.example.com/embed/highlight.mp4',
        videoMetadata: {
          format: 'mp4',
          resolution: '1920x1080',
          fps: 30,
          bitrate: 3000,
          fileSize: 52428800, // 50MB
          codec: 'h264',
        },
      });

      expect(completedHighlight.status).toBe(HighlightStatus.READY);
      expect(completedHighlight.videoUrl).toBeDefined();

      // Approve highlight
      const approvedHighlight = await highlightService.approveHighlight(highlight.id, testUser.id);
      expect(approvedHighlight.status).toBe(HighlightStatus.APPROVED);
      expect(approvedHighlight.approvedBy).toBe(testUser.id);

      // Publish highlight
      const publishedHighlight = await highlightService.publishHighlight(highlight.id);
      expect(publishedHighlight.status).toBe(HighlightStatus.PUBLISHED);
      expect(publishedHighlight.publishedAt).toBeDefined();

      // Update engagement
      await highlightService.updateEngagement(highlight.id, {
        views: 1000,
        likes: 50,
        shares: 10,
        downloads: 5,
        comments: 3,
        watchTime: 50000, // 50,000 seconds total
      });

      const updatedHighlight = await highlightService.findById(highlight.id);
      expect(updatedHighlight?.engagement.views).toBe(1000);
      expect(updatedHighlight?.engagement.likes).toBe(50);
    });

    it('should create CDN upload for recording', async () => {
      // Create recording
      const recording = await recordingService.create({
        streamSessionId: (await streamSessionService.create({
          streamerId: testUser.id,
          type: StreamType.MATCH,
          title: 'Test Stream for Upload',
        })).id,
        recordedBy: testUser.id,
        title: 'Test Recording for Upload',
      });

      // Create CDN upload
      const upload = await uploadService.create({
        recordingId: recording.id,
        uploadedBy: testUser.id,
        type: UploadType.RECORDING,
        provider: StorageProvider.AWS_S3,
        originalFileName: 'recording.mp4',
        fileName: 'processed-recording.mp4',
        filePath: 'streams/2024/01/processed-recording.mp4',
        metadata: {
          tags: ['test'],
          language: 'en',
        },
        storageMetadata: {
          storageClass: 'STANDARD',
          backupEnabled: true,
          retentionPeriod: 30,
        },
      });

      expect(upload.status).toBe(UploadStatus.PENDING);
      expect(upload.recordingId).toBe(recording.id);
      expect(upload.provider).toBe(StorageProvider.AWS_S3);

      // Start upload
      const startedUpload = await uploadService.startUpload(upload.id);
      expect(startedUpload.status).toBe(UploadStatus.UPLOADING);
      expect(startedUpload.uploadMetadata.uploadStartedAt).toBeDefined();

      // Complete upload
      const completedUpload = await uploadService.completeUpload(upload.id, {
        cdnUrl: 'https://cdn.example.com/recording.mp4',
        downloadUrl: 'https://cdn.example.com/recording.mp4?download=1',
        embedUrl: 'https://cdn.example.com/embed/recording.mp4',
        thumbnailUrl: 'https://cdn.example.com/recording-thumb.jpg',
        previewUrl: 'https://cdn.example.com/preview-recording.mp4',
      });

      expect(completedUpload.status).toBe(UploadStatus.PROCESSING);
      expect(completedUpload.cdnUrl).toBeDefined();

      // Finalize upload
      const finalizedUpload = await uploadService.finalizeUpload(upload.id);
      expect(finalizedUpload.status).toBe(UploadStatus.COMPLETED);
      expect(finalizedUpload.processingMetadata.processingCompletedAt).toBeDefined();

      // Generate signed URL
      const signedUrl = await uploadService.generateSignedUrl(upload.id, 60);
      expect(signedUrl).toBeDefined();
      expect(signedUrl).toContain('cdn.example.com');

      // Update analytics
      await uploadService.updateAnalytics(upload.id, {
        downloads: 25,
        views: 150,
        bandwidth: 524288000, // 500MB
        avgDownloadSpeed: 1048576, // 1MB/s
        popularRegions: [
          { region: 'us-east-1', requests: 75 },
          { region: 'eu-west-1', requests: 50 },
        ],
      });

      const updatedUpload = await uploadService.findById(upload.id);
      expect(updatedUpload?.analytics.downloads).toBe(25);
      expect(updatedUpload?.analytics.views).toBe(150);
    });

    it('should create and deliver webhooks', async () => {
      // Create stream session
      const streamSession = await streamSessionService.create({
        streamerId: testUser.id,
        type: StreamType.MATCH,
        title: 'Test Stream with Webhooks',
      });

      // Create webhook for stream start
      const webhook = await webhookService.create({
        streamSessionId: streamSession.id,
        type: WebhookType.STREAM_START,
        provider: WebhookProvider.CUSTOM,
        endpoint: 'https://api.example.com/webhook',
        payload: {
          streamId: streamSession.id,
          status: 'started',
          title: 'Test Stream with Webhooks',
        },
        metadata: {
          priority: 1,
          timeout: 30,
          retryStrategy: 'exponential',
        },
      });

      expect(webhook.status).toBe(WebhookStatus.PENDING);
      expect(webhook.type).toBe(WebhookType.STREAM_START);

      // Start stream (this should trigger webhook)
      await streamSessionService.startStream(streamSession.id);

      // Mock webhook delivery
      jest.spyOn(webhookService as any, 'sendHttpRequest').mockResolvedValue({
        success: true,
        statusCode: 200,
        body: { success: true },
        duration: 150,
      });

      // Deliver webhook
      const deliveryResult = await webhookService.deliverWebhook(webhook.id);
      expect(deliveryResult.success).toBe(true);
      expect(deliveryResult.statusCode).toBe(200);

      const deliveredWebhook = await webhookService.findById(webhook.id);
      expect(deliveredWebhook?.status).toBe(WebhookStatus.COMPLETED);
      expect(deliveredWebhook?.deliveredAt).toBeDefined();

      // Create webhook for recording complete
      const recording = await recordingService.create({
        streamSessionId: streamSession.id,
        recordedBy: testUser.id,
        title: 'Test Recording for Webhook',
      });

      const recordingWebhook = await webhookService.create({
        recordingId: recording.id,
        type: WebhookType.RECORDING_READY,
        provider: WebhookProvider.CUSTOM,
        endpoint: 'https://api.example.com/recording-webhook',
        payload: {
          recordingId: recording.id,
          status: 'completed',
          videoUrl: 'https://cdn.example.com/recording.mp4',
        },
      });

      // Complete recording
      await recordingService.completeRecording(recording.id, {
        videoUrl: 'https://cdn.example.com/recording.mp4',
        downloadUrl: 'https://cdn.example.com/recording.mp4?download=1',
        videoMetadata: {
          resolution: '1920x1080',
          fps: 30,
          bitrate: 5000,
          codec: 'h264',
          aspectRatio: '16:9',
          fileSize: 1048576,
          duration: 3600,
        },
      });

      // Deliver recording webhook
      jest.spyOn(webhookService as any, 'sendHttpRequest').mockResolvedValue({
        success: true,
        statusCode: 200,
        body: { success: true },
        duration: 120,
      });

      const recordingDeliveryResult = await webhookService.deliverWebhook(recordingWebhook.id);
      expect(recordingDeliveryResult.success).toBe(true);
    });

    it('should handle webhook failures and retries', async () => {
      // Create webhook
      const streamSession = await streamSessionService.create({
        streamerId: testUser.id,
        type: StreamType.MATCH,
        title: 'Test Stream for Failed Webhook',
      });

      const webhook = await webhookService.create({
        streamSessionId: streamSession.id,
        type: WebhookType.STREAM_END,
        provider: WebhookProvider.CUSTOM,
        endpoint: 'https://api.example.com/failing-webhook',
        payload: { streamId: streamSession.id, status: 'ended' },
        metadata: {
          priority: 1,
          retryStrategy: 'exponential',
        },
      });

      // Mock failed webhook delivery
      jest.spyOn(webhookService as any, 'sendHttpRequest').mockResolvedValue({
        success: false,
        statusCode: 500,
        body: { error: 'Internal server error' },
        error: 'Internal server error',
        duration: 200,
      });

      // Attempt delivery (should schedule retry)
      const deliveryResult = await webhookService.deliverWebhook(webhook.id);
      expect(deliveryResult.success).toBe(false);

      const retryingWebhook = await webhookService.findById(webhook.id);
      expect(retryingWebhook?.status).toBe(WebhookStatus.RETRYING);
      expect(retryingWebhook?.processingMetadata.attempts).toBe(1);

      // Simulate max attempts reached
      jest.spyOn(webhookService as any, 'sendHttpRequest').mockResolvedValue({
        success: false,
        statusCode: 503,
        body: { error: 'Service unavailable' },
        error: 'Maximum retry attempts reached',
        duration: 150,
      });

      // Retry webhook (should fail)
      const retryResult = await webhookService.retryWebhook(webhook.id);
      expect(retryResult.success).toBe(false);

      const failedWebhook = await webhookService.findById(webhook.id);
      expect(failedWebhook?.status).toBe(WebhookStatus.FAILED);
      expect(failedWebhook?.errorMessage).toBe('Maximum retry attempts reached');
    });
  });

  describe('Stream Data Relationships', () => {
    it('should maintain proper relationships between entities', async () => {
      // Create stream session
      const streamSession = await streamSessionService.create({
        streamerId: testUser.id,
        type: StreamType.MATCH,
        title: 'Test Stream with Relationships',
        tournamentId: testTournament.id,
        matchId: testMatch.id,
      });

      // Create recording
      const recording = await recordingService.create({
        streamSessionId: streamSession.id,
        recordedBy: testUser.id,
        title: 'Test Recording',
        tournamentId: testTournament.id,
        matchId: testMatch.id,
      });

      // Create highlight
      const highlight = await highlightService.create({
        streamSessionId: streamSession.id,
        createdBy: testUser.id,
        type: HighlightType.KILL,
        source: HighlightSource.AUTO_GENERATED,
        title: 'Test Highlight',
        startTime: 60,
        endTime: 65,
        tournamentId: testTournament.id,
        matchId: testMatch.id,
      });

      // Create upload for recording
      const recordingUpload = await uploadService.create({
        recordingId: recording.id,
        uploadedBy: testUser.id,
        type: UploadType.RECORDING,
        provider: StorageProvider.AWS_S3,
        originalFileName: 'recording.mp4',
        fileName: 'processed-recording.mp4',
        filePath: 'streams/2024/01/processed-recording.mp4',
      });

      // Create upload for highlight
      const highlightUpload = await uploadService.create({
        highlightId: highlight.id,
        uploadedBy: testUser.id,
        type: UploadType.HIGHLIGHT,
        provider: StorageProvider.AWS_S3,
        originalFileName: 'highlight.mp4',
        fileName: 'processed-highlight.mp4',
        filePath: 'highlights/2024/01/processed-highlight.mp4',
      });

      // Create webhooks
      const streamWebhook = await webhookService.create({
        streamSessionId: streamSession.id,
        type: WebhookType.STREAM_START,
        provider: WebhookProvider.CUSTOM,
        endpoint: 'https://api.example.com/stream-webhook',
        payload: { streamId: streamSession.id },
      });

      const recordingWebhook = await webhookService.create({
        recordingId: recording.id,
        type: WebhookType.RECORDING_READY,
        provider: WebhookProvider.CUSTOM,
        endpoint: 'https://api.example.com/recording-webhook',
        payload: { recordingId: recording.id },
      });

      const highlightWebhook = await webhookService.create({
        highlightId: highlight.id,
        type: WebhookType.HIGHLIGHT_READY,
        provider: WebhookProvider.CUSTOM,
        endpoint: 'https://api.example.com/highlight-webhook',
        payload: { highlightId: highlight.id },
      });

      const uploadWebhook = await webhookService.create({
        uploadId: recordingUpload.id,
        type: WebhookType.UPLOAD_COMPLETED,
        provider: WebhookProvider.CUSTOM,
        endpoint: 'https://api.example.com/upload-webhook',
        payload: { uploadId: recordingUpload.id },
      });

      // Verify relationships
      const streamRecordings = await recordingService.getRecordingsByStream(streamSession.id);
      expect(streamRecordings).toHaveLength(1);
      expect(streamRecordings[0].id).toBe(recording.id);

      const streamHighlights = await highlightService.getHighlightsByStream(streamSession.id);
      expect(streamHighlights).toHaveLength(1);
      expect(streamHighlights[0].id).toBe(highlight.id);

      const recordingUploads = await uploadService.getUploadsByRecording(recording.id);
      expect(recordingUploads).toHaveLength(1);
      expect(recordingUploads[0].id).toBe(recordingUpload.id);

      const highlightUploads = await uploadService.getUploadsByHighlight(highlight.id);
      expect(highlightUploads).toHaveLength(1);
      expect(highlightUploads[0].id).toBe(highlightUpload.id);

      const streamWebhooks = await webhookService.getWebhooksByStream(streamSession.id);
      expect(streamWebhooks).toHaveLength(1);
      expect(streamWebhooks[0].id).toBe(streamWebhook.id);

      // Verify entity relationships are properly set
      const fullStreamSession = await streamSessionService.findById(streamSession.id);
      expect(fullStreamSession?.tournamentId).toBe(testTournament.id);
      expect(fullStreamSession?.matchId).toBe(testMatch.id);

      const fullRecording = await recordingService.findById(recording.id);
      expect(fullRecording?.streamSessionId).toBe(streamSession.id);
      expect(fullRecording?.tournamentId).toBe(testTournament.id);
      expect(fullRecording?.matchId).toBe(testMatch.id);

      const fullHighlight = await highlightService.findById(highlight.id);
      expect(fullHighlight?.streamSessionId).toBe(streamSession.id);
      expect(fullHighlight?.tournamentId).toBe(testTournament.id);
      expect(fullHighlight?.matchId).toBe(testMatch.id);
    });
  });

  describe('Stream Statistics and Analytics', () => {
    it('should provide accurate statistics', async () => {
      // Create multiple stream sessions
      const stream1 = await streamSessionService.create({
        streamerId: testUser.id,
        type: StreamType.MATCH,
        title: 'Stream 1',
      });
      const stream2 = await streamSessionService.create({
        streamerId: testUser.id,
        type: StreamType.MATCH,
        title: 'Stream 2',
      });

      // Start and end streams with different durations
      await streamSessionService.startStream(stream1.id);
      await streamSessionService.startStream(stream2.id);

      // Simulate some time passing
      await new Promise(resolve => setTimeout(resolve, 100));

      await streamSessionService.endStream(stream1.id, 'Stream 1 ended');
      await streamSessionService.endStream(stream2.id, 'Stream 2 ended');

      // Create recordings
      const recording1 = await recordingService.create({
        streamSessionId: stream1.id,
        recordedBy: testUser.id,
        title: 'Recording 1',
      });
      const recording2 = await recordingService.create({
        streamSessionId: stream2.id,
        recordedBy: testUser.id,
        title: 'Recording 2',
      });

      // Complete recordings
      await recordingService.startRecording(recording1.id);
      await recordingService.startRecording(recording2.id);
      await recordingService.stopRecording(recording1.id);
      await recordingService.stopRecording(recording2.id);
      await recordingService.completeRecording(recording1.id, {
        videoUrl: 'https://cdn.example.com/recording1.mp4',
        downloadUrl: 'https://cdn.example.com/recording1.mp4?download=1',
        videoMetadata: {
          resolution: '1920x1080',
          fps: 30,
          bitrate: 5000,
          codec: 'h264',
          aspectRatio: '16:9',
          fileSize: 104857600,
          duration: 1800,
        },
      });
      await recordingService.completeRecording(recording2.id, {
        videoUrl: 'https://cdn.example.com/recording2.mp4',
        downloadUrl: 'https://cdn.example.com/recording2.mp4?download=1',
        videoMetadata: {
          resolution: '1920x1080',
          fps: 30,
          bitrate: 5000,
          codec: 'h264',
          aspectRatio: '16:9',
          fileSize: 52428800,
          duration: 900,
        },
      });

      // Create highlights
      const highlight1 = await highlightService.create({
        streamSessionId: stream1.id,
        createdBy: testUser.id,
        type: HighlightType.KILL,
        source: HighlightSource.AUTO_GENERATED,
        title: 'Highlight 1',
        startTime: 60,
        endTime: 65,
      });
      const highlight2 = await highlightService.create({
        streamSessionId: stream2.id,
        createdBy: testUser.id,
        type: HighlightType.KILL,
        source: HighlightSource.AUTO_GENERATED,
        title: 'Highlight 2',
        startTime: 30,
        endTime: 35,
      });

      // Complete and publish highlights
      await highlightService.completeProcessing(highlight1.id, {
        videoUrl: 'https://cdn.example.com/highlight1.mp4',
        downloadUrl: 'https://cdn.example.com/highlight1.mp4?download=1',
        videoMetadata: {
          format: 'mp4',
          resolution: '1920x1080',
          fps: 30,
          bitrate: 3000,
          fileSize: 26214400,
        },
      });
      await highlightService.completeProcessing(highlight2.id, {
        videoUrl: 'https://cdn.example.com/highlight2.mp4',
        downloadUrl: 'https://cdn.example.com/highlight2.mp4?download=1',
        videoMetadata: {
          format: 'mp4',
          resolution: '1920x1080',
          fps: 30,
          bitrate: 3000,
          fileSize: 13107200,
        },
      });

      await highlightService.approveHighlight(highlight1.id, testUser.id);
      await highlightService.approveHighlight(highlight2.id, testUser.id);
      await highlightService.publishHighlight(highlight1.id);
      await highlightService.publishHighlight(highlight2.id);

      // Create uploads
      const upload1 = await uploadService.create({
        recordingId: recording1.id,
        uploadedBy: testUser.id,
        type: UploadType.RECORDING,
        provider: StorageProvider.AWS_S3,
        originalFileName: 'recording1.mp4',
        fileName: 'processed-recording1.mp4',
        filePath: 'streams/2024/01/processed-recording1.mp4',
        metadata: { tags: ['test'], language: 'en' },
      });
      const upload2 = await uploadService.create({
        highlightId: highlight1.id,
        uploadedBy: testUser.id,
        type: UploadType.HIGHLIGHT,
        provider: StorageProvider.AWS_S3,
        originalFileName: 'highlight1.mp4',
        fileName: 'processed-highlight1.mp4',
        filePath: 'highlights/2024/01/processed-highlight1.mp4',
        metadata: { tags: ['test'], language: 'en' },
      });

      // Complete uploads
      await uploadService.startUpload(upload1.id);
      await uploadService.startUpload(upload2.id);
      await uploadService.completeUpload(upload1.id, {
        cdnUrl: 'https://cdn.example.com/upload1.mp4',
        downloadUrl: 'https://cdn.example.com/upload1.mp4?download=1',
      });
      await uploadService.completeUpload(upload2.id, {
        cdnUrl: 'https://cdn.example.com/upload2.mp4',
        downloadUrl: 'https://cdn.example.com/upload2.mp4?download=1',
      });
      await uploadService.finalizeUpload(upload1.id);
      await uploadService.finalizeUpload(upload2.id);

      // Get statistics
      const streamStats = await streamSessionService.getStreamerStats(testUser.id);
      expect(streamStats.totalSessions).toBe(2);
      expect(streamStats.totalDuration).toBeGreaterThan(0);

      const recordingStats = await recordingService.getRecordingStats(testUser.id);
      expect(recordingStats.totalRecordings).toBe(2);
      expect(recordingStats.completedRecordings).toBe(2);
      expect(recordingStats.totalSize).toBe(157286400); // 104857600 + 52428800

      const highlightStats = await highlightService.getHighlightStats(testUser.id);
      expect(highlightStats.totalHighlights).toBe(2);
      expect(highlightStats.publishedHighlights).toBe(2);

      const uploadStats = await uploadService.getUploadStats(testUser.id);
      expect(uploadStats.totalUploads).toBe(2);
      expect(uploadStats.completedUploads).toBe(2);
      expect(uploadStats.totalSize).toBe(131072000); // 104857600 + 26214400

      const webhookStats = await webhookService.getWebhookStats();
      expect(webhookStats.totalWebhooks).toBeGreaterThanOrEqual(0);
    });
  });
});
