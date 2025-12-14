import { Repository, DataSource } from 'typeorm';
import { Injectable } from '@nestjs/common';
import {
  StreamWebhookEntity,
  WebhookType,
  WebhookStatus,
  WebhookProvider,
  StreamSessionEntity,
  RecordingEntity,
  HighlightEntity,
  CdnUploadEntity,
} from '../database/entities';
import { NotFoundError, ValidationError } from './errors';
import { CacheService } from './cache.service';
import { NotificationService } from './notification.service';

export interface CreateWebhookInput {
  streamSessionId?: string;
  recordingId?: string;
  highlightId?: string;
  uploadId?: string;
  type: WebhookType;
  provider: WebhookProvider;
  endpoint: string;
  event_id?: string;
  payload: Record<string, any>;
  headers?: Record<string, string>;
  signature?: string;
  metadata?: {
    priority?: number;
    timeout?: number;
    retryStrategy?: 'linear' | 'exponential' | 'fixed';
    webhookSecret?: string;
    tags?: string[];
  };
  region?: string;
}

export interface WebhookQueryOptions {
  streamSessionId?: string;
  recordingId?: string;
  highlightId?: string;
  uploadId?: string;
  type?: WebhookType;
  status?: WebhookStatus;
  provider?: WebhookProvider;
  region?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'deliveredAt' | 'attempts';
  sortOrder?: 'asc' | 'desc';
}

export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  response?: any;
  error?: string;
  duration?: number;
}

@Injectable()
export class StreamWebhookService {
  constructor(
    private readonly webhookRepo: Repository<StreamWebhookEntity>,
    private readonly streamSessionRepo: Repository<StreamSessionEntity>,
    private readonly recordingRepo: Repository<RecordingEntity>,
    private readonly highlightRepo: Repository<HighlightEntity>,
    private readonly uploadRepo: Repository<CdnUploadEntity>,
    private readonly dataSource: DataSource,
    private readonly cacheService: CacheService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(input: CreateWebhookInput): Promise<StreamWebhookEntity> {
    // Validate related entities exist
    if (input.streamSessionId) {
      const streamSession = await this.streamSessionRepo.findOne({ 
        where: { id: input.streamSessionId } 
      });
      if (!streamSession) {
        throw new NotFoundError('Stream session', input.streamSessionId);
      }
    }

    if (input.recordingId) {
      const recording = await this.recordingRepo.findOne({ 
        where: { id: input.recordingId } 
      });
      if (!recording) {
        throw new NotFoundError('Recording', input.recordingId);
      }
    }

    if (input.highlightId) {
      const highlight = await this.highlightRepo.findOne({ 
        where: { id: input.highlightId } 
      });
      if (!highlight) {
        throw new NotFoundError('Highlight', input.highlightId);
      }
    }

    if (input.uploadId) {
      const upload = await this.uploadRepo.findOne({ 
        where: { id: input.uploadId } 
      });
      if (!upload) {
        throw new NotFoundError('Upload', input.uploadId);
      }
    }

    const webhook = this.webhookRepo.create({
      ...input,
      status: WebhookStatus.PENDING,
      headers: input.headers || {},
      response: {},
      processingMetadata: {
        attempts: 0,
        maxAttempts: 3,
        retryDelay: 60, // 1 minute default
        processingStartedAt: new Date(),
      },
      metadata: {
        priority: input.metadata?.priority || 0,
        timeout: input.metadata?.timeout || 30, // 30 seconds default
        retryStrategy: input.metadata?.retryStrategy || 'exponential',
        webhookSecret: input.metadata?.webhookSecret,
        tags: input.metadata?.tags || [],
      },
      region: input.region || 'global',
    });

    const savedWebhook = await this.webhookRepo.save(webhook);

    // Cache the webhook
    await this.cacheService.set(
      `webhook:${savedWebhook.id}`,
      savedWebhook,
      3600 // 1 hour
    );

    // Queue webhook for processing
    await this.queueWebhook(savedWebhook.id);

    return savedWebhook;
  }

  async findById(id: string): Promise<StreamWebhookEntity | null> {
    // Try cache first
    const cached = await this.cacheService.get<StreamWebhookEntity>(
      `webhook:${id}`
    );
    if (cached) {
      return cached;
    }

    const webhook = await this.webhookRepo.findOne({ where: { id } });

    if (webhook) {
      await this.cacheService.set(`webhook:${id}`, webhook, 3600);
    }

    return webhook;
  }

  async deliverWebhook(id: string): Promise<WebhookDeliveryResult> {
    const webhook = await this.findById(id);
    if (!webhook) {
      throw new NotFoundError('Webhook', id);
    }

    if (webhook.status !== WebhookStatus.PENDING && webhook.status !== WebhookStatus.RETRYING) {
      throw new ValidationError('Webhook is not in deliverable status');
    }

    // Check if max attempts reached
    if (webhook.processingMetadata.attempts >= webhook.processingMetadata.maxAttempts) {
      await this.failWebhook(id, 'Maximum retry attempts reached');
      return {
        success: false,
        error: 'Maximum retry attempts reached',
      };
    }

    const startTime = Date.now();
    webhook.status = WebhookStatus.PROCESSING;
    webhook.processingMetadata.attempts += 1;
    webhook.processingMetadata.lastAttemptAt = new Date();

    await this.webhookRepo.save(webhook);

    try {
      // Prepare webhook payload
      const payload = this.prepareWebhookPayload(webhook);
      const headers = this.prepareWebhookHeaders(webhook);

      // Deliver webhook (this would use actual HTTP client)
      const result = await this.sendHttpRequest(webhook.endpoint, payload, headers, webhook.metadata.timeout);

      const duration = Date.now() - startTime;

      // Update webhook with delivery result
      webhook.response = {
        statusCode: result.statusCode,
        body: result.response,
        duration: result.duration,
      };

      if (result.success) {
        webhook.status = WebhookStatus.COMPLETED;
        webhook.deliveredAt = new Date();
        
        await this.webhookRepo.save(webhook);

        // Update cache
        await this.cacheService.set(
          `webhook:${id}`,
          webhook,
          3600
        );

        // Send success notification
        await this.sendWebhookNotification(webhook, true);

        return {
          success: true,
          statusCode: result.statusCode,
          response: result.response,
          duration,
        };
      } else {
        // Schedule retry
        await this.scheduleRetry(webhook);
        
        return {
          success: false,
          statusCode: result.statusCode,
          response: result.response,
          error: result.error,
          duration,
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = (error as Error).message;

      webhook.response = {
        duration,
      };

      await this.scheduleRetry(webhook, errorMessage);

      return {
        success: false,
        error: errorMessage,
        duration,
      };
    }
  }

  async failWebhook(id: string, errorMessage: string): Promise<StreamWebhookEntity> {
    const webhook = await this.findById(id);
    if (!webhook) {
      throw new NotFoundError('Webhook', id);
    }

    webhook.status = WebhookStatus.FAILED;
    webhook.errorMessage = errorMessage;
    webhook.processingMetadata.processingCompletedAt = new Date();

    const updatedWebhook = await this.webhookRepo.save(webhook);

    // Update cache
    await this.cacheService.set(
      `webhook:${id}`,
      updatedWebhook,
      3600
    );

    // Send failure notification
    await this.sendWebhookNotification(webhook, false, errorMessage);

    return updatedWebhook;
  }

  async retryWebhook(id: string): Promise<WebhookDeliveryResult> {
    const webhook = await this.findById(id);
    if (!webhook) {
      throw new NotFoundError('Webhook', id);
    }

    if (webhook.status !== WebhookStatus.FAILED) {
      throw new ValidationError('Only failed webhooks can be retried');
    }

    // Reset webhook for retry
    webhook.status = WebhookStatus.RETRYING;
    webhook.processingMetadata.attempts = 0;
    webhook.errorMessage = undefined;
    webhook.response = {};

    await this.webhookRepo.save(webhook);

    // Update cache
    await this.cacheService.set(
      `webhook:${id}`,
      webhook,
      3600
    );

    // Deliver webhook
    return await this.deliverWebhook(id);
  }

  async findMany(options: WebhookQueryOptions): Promise<{
    webhooks: StreamWebhookEntity[];
    total: number;
  }> {
    const queryBuilder = this.webhookRepo.createQueryBuilder('webhook');

    if (options.streamSessionId) {
      queryBuilder.andWhere('webhook.streamSessionId = :streamSessionId', {
        streamSessionId: options.streamSessionId,
      });
    }

    if (options.recordingId) {
      queryBuilder.andWhere('webhook.recordingId = :recordingId', {
        recordingId: options.recordingId,
      });
    }

    if (options.highlightId) {
      queryBuilder.andWhere('webhook.highlightId = :highlightId', {
        highlightId: options.highlightId,
      });
    }

    if (options.uploadId) {
      queryBuilder.andWhere('webhook.uploadId = :uploadId', {
        uploadId: options.uploadId,
      });
    }

    if (options.type) {
      queryBuilder.andWhere('webhook.type = :type', { type: options.type });
    }

    if (options.status) {
      queryBuilder.andWhere('webhook.status = :status', { status: options.status });
    }

    if (options.provider) {
      queryBuilder.andWhere('webhook.provider = :provider', { provider: options.provider });
    }

    if (options.region) {
      queryBuilder.andWhere('webhook.region = :region', { region: options.region });
    }

    // Sorting
    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder || 'desc';
    queryBuilder.orderBy(`webhook.${sortBy}`, sortOrder as 'ASC' | 'DESC');

    // Pagination
    const limit = Math.min(options.limit || 50, 100);
    const offset = options.offset || 0;

    const [webhooks, total] = await queryBuilder
      .limit(limit)
      .offset(offset)
      .getManyAndCount();

    return { webhooks, total };
  }

  async delete(id: string): Promise<void> {
    const webhook = await this.findById(id);
    if (!webhook) {
      throw new NotFoundError('Webhook', id);
    }

    // Don't allow deletion of webhooks in progress
    if (webhook.status === WebhookStatus.PROCESSING) {
      throw new ValidationError('Cannot delete webhook while processing');
    }

    await this.webhookRepo.remove(webhook);

    // Remove from cache
    await this.cacheService.delete(`webhook:${id}`);
  }

  async getWebhooksByStream(streamSessionId: string): Promise<StreamWebhookEntity[]> {
    const cacheKey = `webhooks_stream:${streamSessionId}`;
    const cached = await this.cacheService.get<StreamWebhookEntity[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const webhooks = await this.webhookRepo.find({
      where: { streamSessionId },
      order: { createdAt: 'DESC' },
    });

    // Cache for 5 minutes
    await this.cacheService.set(cacheKey, webhooks, 300);

    return webhooks;
  }

  async getPendingWebhooks(): Promise<StreamWebhookEntity[]> {
    const cacheKey = 'pending_webhooks';
    const cached = await this.cacheService.get<StreamWebhookEntity[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const webhooks = await this.webhookRepo.find({
      where: [
        { status: WebhookStatus.PENDING },
        { status: WebhookStatus.RETRYING },
      ],
      order: { createdAt: 'ASC' },
    });

    // Cache for 2 minutes
    await this.cacheService.set(cacheKey, webhooks, 120);

    return webhooks;
  }

  async getWebhookStats(): Promise<{
    totalWebhooks: number;
    completedWebhooks: number;
    failedWebhooks: number;
    pendingWebhooks: number;
    avgDeliveryTime: number;
    successRate: number;
  }> {
    const webhooks = await this.webhookRepo.find();

    const totalWebhooks = webhooks.length;
    const completedWebhooks = webhooks.filter(w => w.status === WebhookStatus.COMPLETED).length;
    const failedWebhooks = webhooks.filter(w => w.status === WebhookStatus.FAILED).length;
    const pendingWebhooks = webhooks.filter(w => w.status === WebhookStatus.PENDING).length;

    const avgDeliveryTime = completedWebhooks > 0
      ? webhooks
          .filter(w => w.response.duration)
          .reduce((sum, w) => sum + (w.response.duration || 0), 0) / completedWebhooks
      : 0;

    const successRate = totalWebhooks > 0 ? (completedWebhooks / totalWebhooks) * 100 : 0;

    return {
      totalWebhooks,
      completedWebhooks,
      failedWebhooks,
      pendingWebhooks,
      avgDeliveryTime,
      successRate,
    };
  }

  private async queueWebhook(webhookId: string): Promise<void> {
    // This would integrate with a job queue (like Bull Queue)
    // For now, we'll just update the cache to indicate it's queued
    await this.cacheService.set(`webhook_queue:${webhookId}`, true, 3600);
  }

  private prepareWebhookPayload(webhook: StreamWebhookEntity): Record<string, any> {
    return {
      id: webhook.id,
      type: webhook.type,
      provider: webhook.provider,
      event_id: webhook.event_id,
      timestamp: webhook.createdAt.toISOString(),
      payload: webhook.payload,
      stream_session_id: webhook.streamSessionId,
      recording_id: webhook.recordingId,
      highlight_id: webhook.highlightId,
      upload_id: webhook.uploadId,
    };
  }

  private prepareWebhookHeaders(webhook: StreamWebhookEntity): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'RBX-Webhook-Service/1.0',
      'X-Webhook-ID': webhook.id,
      'X-Webhook-Type': webhook.type,
      'X-Webhook-Provider': webhook.provider,
      ...webhook.headers,
    };

    // Add signature if webhook secret is provided
    if (webhook.metadata.webhookSecret) {
      const signature = this.generateWebhookSignature(webhook, webhook.metadata.webhookSecret);
      headers['X-Webhook-Signature'] = signature;
    }

    return headers;
  }

  private generateWebhookSignature(webhook: StreamWebhookEntity, secret: string): string {
    // This would generate a proper HMAC signature
    // For now, return a mock signature
    const payload = JSON.stringify(this.prepareWebhookPayload(webhook));
    return `sha256=${Buffer.from(`${payload}${secret}`).toString('base64')}`;
  }

  private async sendHttpRequest(
    endpoint: string,
    payload: Record<string, any>,
    headers: Record<string, string>,
    timeout: number
  ): Promise<WebhookDeliveryResult> {
    // This would use an actual HTTP client (like Axios)
    // For now, return a mock response
    return {
      success: true,
      statusCode: 200,
      response: { status: 'ok' },
      duration: 150,
    };
  }

  private async scheduleRetry(webhook: StreamWebhookEntity, errorMessage?: string): Promise<void> {
    webhook.status = WebhookStatus.RETRYING;
    webhook.errorMessage = errorMessage;

    // Calculate next retry time based on strategy
    const retryDelay = this.calculateRetryDelay(
      webhook.processingMetadata.attempts,
      webhook.processingMetadata.retryDelay,
      webhook.metadata.retryStrategy
    );

    webhook.processingMetadata.nextRetryAt = new Date(Date.now() + retryDelay * 1000);

    await this.webhookRepo.save(webhook);

    // Update cache
    await this.cacheService.set(
      `webhook:${webhook.id}`,
      webhook,
      3600
    );

    // Queue webhook for retry
    await this.queueWebhook(webhook.id);
  }

  private calculateRetryDelay(
    attempts: number,
    baseDelay: number,
    strategy: 'linear' | 'exponential' | 'fixed'
  ): number {
    switch (strategy) {
      case 'linear':
        return baseDelay * attempts;
      case 'exponential':
        return baseDelay * Math.pow(2, attempts - 1);
      case 'fixed':
      default:
        return baseDelay;
    }
  }

  private async sendWebhookNotification(
    webhook: StreamWebhookEntity,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    // This would send notifications to relevant users
    // For now, we'll just log it
    console.log(`Webhook ${webhook.id} ${success ? 'delivered' : 'failed'}${errorMessage ? `: ${errorMessage}` : ''}`);
  }
}
