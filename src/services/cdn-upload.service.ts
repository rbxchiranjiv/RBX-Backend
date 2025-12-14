import { Repository, DataSource } from 'typeorm';
import { Injectable } from '@nestjs/common';
import {
  CdnUploadEntity,
  UploadStatus,
  UploadType,
  StorageProvider,
  RecordingEntity,
  HighlightEntity,
  UserEntity,
} from '../database/entities';
import { NotFoundError, ValidationError } from './errors';
import { CacheService } from './cache.service';
import { NotificationService } from './notification.service';

export interface CreateUploadInput {
  recordingId?: string;
  highlightId?: string;
  uploadedBy: string;
  type: UploadType;
  provider: StorageProvider;
  originalFileName: string;
  fileName: string;
  filePath: string;
  bucket?: string;
  region?: string;
  fileMetadata?: {
    mimeType: string;
    size: number;
    checksum?: string;
    encoding?: string;
    lastModified?: Date;
  };
  storageMetadata?: {
    storageClass?: string;
    encryption?: string;
    backupEnabled?: boolean;
    retentionPeriod?: number;
    accessControl?: string;
  };
  uploadMetadata?: {
    uploadId?: string;
    multipart?: boolean;
    partSize?: number;
    totalParts?: number;
  };
  metadata?: {
    tags?: string[];
    language?: string;
    featured?: boolean;
    priority?: number;
    autoUploaded?: boolean;
    publicAccess?: boolean;
    allowedOrigins?: string[];
    maxDownloads?: number;
    downloadExpiry?: Date;
  };
}

export interface UpdateUploadInput {
  status?: UploadStatus;
  cdnUrl?: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  downloadUrl?: string;
  embedUrl?: string;
  metadata?: Record<string, any>;
  expiresAt?: Date;
}

export interface UploadQueryOptions {
  recordingId?: string;
  highlightId?: string;
  uploadedBy?: string;
  status?: UploadStatus;
  type?: UploadType;
  provider?: StorageProvider;
  region?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'size' | 'downloads' | 'views';
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class CdnUploadService {
  constructor(
    private readonly uploadRepo: Repository<CdnUploadEntity>,
    private readonly recordingRepo: Repository<RecordingEntity>,
    private readonly highlightRepo: Repository<HighlightEntity>,
    private readonly userRepo: Repository<UserEntity>,
    private readonly dataSource: DataSource,
    private readonly cacheService: CacheService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(input: CreateUploadInput): Promise<CdnUploadEntity> {
    // Validate uploader exists
    const uploader = await this.userRepo.findOne({ 
      where: { id: input.uploadedBy } 
    });
    if (!uploader) {
      throw new NotFoundError('Uploader', input.uploadedBy);
    }

    // Validate recording if provided
    if (input.recordingId) {
      const recording = await this.recordingRepo.findOne({ 
        where: { id: input.recordingId } 
      });
      if (!recording) {
        throw new NotFoundError('Recording', input.recordingId);
      }
    }

    // Validate highlight if provided
    if (input.highlightId) {
      const highlight = await this.highlightRepo.findOne({ 
        where: { id: input.highlightId } 
      });
      if (!highlight) {
        throw new NotFoundError('Highlight', input.highlightId);
      }
    }

    // Validate that either recording or highlight is provided
    if (!input.recordingId && !input.highlightId) {
      throw new ValidationError('Either recordingId or highlightId must be provided');
    }

    const upload = this.uploadRepo.create({
      ...input,
      status: UploadStatus.PENDING,
      fileMetadata: {
        mimeType: input.fileMetadata?.mimeType,
        size: input.fileMetadata?.size || 0,
        checksum: input.fileMetadata?.checksum,
        encoding: input.fileMetadata?.encoding,
        lastModified: input.fileMetadata?.lastModified,
      },
      uploadMetadata: {
        uploadId: input.uploadMetadata?.uploadId,
        multipart: input.uploadMetadata?.multipart ?? false,
        partSize: input.uploadMetadata?.partSize,
        totalParts: input.uploadMetadata?.totalParts,
        completedParts: [],
        uploadStartedAt: new Date(),
        retryCount: 0,
      },
      processingMetadata: {
        processingStartedAt: new Date(),
        processingSteps: [
          {
            step: 'initialization',
            startedAt: new Date(),
            completedAt: new Date(),
            status: 'completed',
          },
        ],
        transcodingEnabled: false,
        outputFormats: [],
        thumbnailGenerated: false,
        previewGenerated: false,
      },
      storageMetadata: {
        provider: input.provider,
        bucket: input.bucket || this.getDefaultBucket(input.provider),
        storageClass: input.storageMetadata?.storageClass || 'STANDARD',
        encryption: input.storageMetadata?.encryption,
        backupEnabled: input.storageMetadata?.backupEnabled ?? true,
        retentionPeriod: input.storageMetadata?.retentionPeriod || 30, // 30 days default
        accessControl: input.storageMetadata?.accessControl || 'private',
      },
      region: input.region || this.getDefaultRegion(input.provider),
      analytics: {
        downloads: 0,
        views: 0,
        bandwidth: 0,
        avgDownloadSpeed: 0,
        popularRegions: [],
      },
      metadata: {
        tags: input.metadata?.tags || [],
        language: input.metadata?.language,
        featured: input.metadata?.featured ?? false,
        priority: input.metadata?.priority || 0,
        autoUploaded: input.metadata?.autoUploaded ?? false,
        publicAccess: input.metadata?.publicAccess ?? false,
        allowedOrigins: input.metadata?.allowedOrigins || [],
        maxDownloads: input.metadata?.maxDownloads,
        downloadExpiry: input.metadata?.downloadExpiry,
      },
    });

    const savedUpload = await this.uploadRepo.save(upload);

    // Cache the upload
    await this.cacheService.set(
      `upload:${savedUpload.id}`,
      savedUpload,
      3600 // 1 hour
    );

    // Send notification to uploader
    await this.notificationService.create({
      userId: input.uploadedBy,
      templateKey: 'upload_created',
      channel: 'inApp',
      payload: {
        uploadId: savedUpload.id,
        fileName: savedUpload.fileName,
        type: savedUpload.type,
        provider: savedUpload.provider,
        size: savedUpload.fileMetadata.size,
      },
    });

    return savedUpload;
  }

  async findById(id: string): Promise<CdnUploadEntity | null> {
    // Try cache first
    const cached = await this.cacheService.get<CdnUploadEntity>(
      `upload:${id}`
    );
    if (cached) {
      return cached;
    }

    const upload = await this.uploadRepo.findOne({
      where: { id },
      relations: ['recording', 'highlight', 'uploader'],
    });

    if (upload) {
      await this.cacheService.set(`upload:${id}`, upload, 3600);
    }

    return upload;
  }

  async update(
    id: string,
    input: UpdateUploadInput
  ): Promise<CdnUploadEntity> {
    const upload = await this.findById(id);
    if (!upload) {
      throw new NotFoundError('Upload', id);
    }

    // Don't allow updates if upload is completed
    if (upload.status === UploadStatus.COMPLETED) {
      throw new ValidationError('Cannot update completed upload');
    }

    Object.assign(upload, input);

    const updatedUpload = await this.uploadRepo.save(upload);

    // Update cache
    await this.cacheService.set(
      `upload:${id}`,
      updatedUpload,
      3600
    );

    return updatedUpload;
  }

  async startUpload(id: string): Promise<CdnUploadEntity> {
    const upload = await this.findById(id);
    if (!upload) {
      throw new NotFoundError('Upload', id);
    }

    if (upload.status !== UploadStatus.PENDING) {
      throw new ValidationError('Upload is not in pending status');
    }

    upload.status = UploadStatus.UPLOADING;
    upload.uploadMetadata.uploadStartedAt = new Date();

    const updatedUpload = await this.uploadRepo.save(upload);

    // Update cache
    await this.cacheService.set(
      `upload:${id}`,
      updatedUpload,
      3600
    );

    // Send notification
    await this.notificationService.create({
      userId: upload.uploadedBy,
      templateKey: 'upload_started',
      channel: 'inApp',
      payload: {
        uploadId: upload.id,
        fileName: upload.fileName,
        startedAt: upload.uploadMetadata.uploadStartedAt,
      },
    });

    return updatedUpload;
  }

  async completeUpload(
    id: string,
    completionData: {
      cdnUrl: string;
      downloadUrl?: string;
      embedUrl?: string;
      thumbnailUrl?: string;
      previewUrl?: string;
    }
  ): Promise<CdnUploadEntity> {
    const upload = await this.findById(id);
    if (!upload) {
      throw new NotFoundError('Upload', id);
    }

    if (upload.status !== UploadStatus.UPLOADING) {
      throw new ValidationError('Upload is not in uploading status');
    }

    upload.status = UploadStatus.PROCESSING;
    upload.cdnUrl = completionData.cdnUrl;
    upload.downloadUrl = completionData.downloadUrl;
    upload.embedUrl = completionData.embedUrl;
    upload.thumbnailUrl = completionData.thumbnailUrl;
    upload.previewUrl = completionData.previewUrl;

    upload.uploadMetadata.uploadCompletedAt = new Date();
    upload.uploadMetadata.uploadDuration = upload.uploadMetadata.uploadStartedAt
      ? Math.floor((upload.uploadMetadata.uploadCompletedAt.getTime() - upload.uploadMetadata.uploadStartedAt.getTime()) / 1000)
      : 0;

    upload.processingMetadata.processingSteps.push({
      step: 'post_processing',
      startedAt: new Date(),
      status: 'processing',
    });

    const updatedUpload = await this.uploadRepo.save(upload);

    // Update cache
    await this.cacheService.set(
      `upload:${id}`,
      updatedUpload,
      3600
    );

    return updatedUpload;
  }

  async finalizeUpload(id: string): Promise<CdnUploadEntity> {
    const upload = await this.findById(id);
    if (!upload) {
      throw new NotFoundError('Upload', id);
    }

    if (upload.status !== UploadStatus.PROCESSING) {
      throw new ValidationError('Upload is not in processing status');
    }

    upload.status = UploadStatus.COMPLETED;

    upload.processingMetadata.processingCompletedAt = new Date();
    upload.processingMetadata.processingSteps = upload.processingMetadata.processingSteps.map(step => 
      step.status === 'processing' 
        ? { ...step, completedAt: new Date(), status: 'completed' as const }
        : step
    );

    const updatedUpload = await this.uploadRepo.save(upload);

    // Update cache
    await this.cacheService.set(
      `upload:${id}`,
      updatedUpload,
      3600
    );

    // Send notification
    await this.notificationService.create({
      userId: upload.uploadedBy,
      templateKey: 'upload_completed',
      channel: 'inApp',
      payload: {
        uploadId: upload.id,
        fileName: upload.fileName,
        cdnUrl: upload.cdnUrl,
        downloadUrl: upload.downloadUrl,
        completedAt: upload.processingMetadata.processingCompletedAt,
      },
    });

    return updatedUpload;
  }

  async failUpload(id: string, errorMessage: string): Promise<CdnUploadEntity> {
    const upload = await this.findById(id);
    if (!upload) {
      throw new NotFoundError('Upload', id);
    }

    upload.status = UploadStatus.FAILED;
    upload.errorMessage = errorMessage;

    upload.uploadMetadata.lastRetryAt = new Date();
    upload.uploadMetadata.retryCount += 1;

    upload.processingMetadata.processingCompletedAt = new Date();
    upload.processingMetadata.processingSteps = upload.processingMetadata.processingSteps.map(step => 
      step.status === 'processing' 
        ? { ...step, completedAt: new Date(), status: 'failed' as const, error: errorMessage }
        : step
    );

    const updatedUpload = await this.uploadRepo.save(upload);

    // Update cache
    await this.cacheService.set(
      `upload:${id}`,
      updatedUpload,
      3600
    );

    // Send notification
    await this.notificationService.create({
      userId: upload.uploadedBy,
      templateKey: 'upload_failed',
      channel: 'inApp',
      payload: {
        uploadId: upload.id,
        fileName: upload.fileName,
        errorMessage,
        retryCount: upload.uploadMetadata.retryCount,
      },
    });

    return updatedUpload;
  }

  async generateSignedUrl(id: string, expiryMinutes: number = 60): Promise<string> {
    const upload = await this.findById(id);
    if (!upload) {
      throw new NotFoundError('Upload', id);
    }

    if (upload.status !== UploadStatus.COMPLETED) {
      throw new ValidationError('Upload must be completed to generate signed URL');
    }

    // Generate signed URL (this would integrate with actual CDN provider)
    const signedUrl = this.generateProviderSignedUrl(upload, expiryMinutes);

    // Update upload with signed URL
    upload.signedUrl = signedUrl;
    upload.signedUrlExpiry = new Date(Date.now() + expiryMinutes * 60 * 1000);

    await this.uploadRepo.save(upload);

    // Update cache
    await this.cacheService.set(
      `upload:${id}`,
      upload,
      3600
    );

    return signedUrl;
  }

  async updateAnalytics(
    id: string,
    analyticsData: {
      downloads?: number;
      views?: number;
      bandwidth?: number;
      avgDownloadSpeed?: number;
      popularRegions?: Array<{
        region: string;
        requests: number;
      }>;
    }
  ): Promise<void> {
    const upload = await this.findById(id);
    if (!upload) {
      throw new NotFoundError('Upload', id);
    }

    upload.analytics = {
      ...upload.analytics,
      ...analyticsData,
    };

    await this.uploadRepo.save(upload);

    // Update cache
    await this.cacheService.set(
      `upload:${id}`,
      upload,
      3600
    );
  }

  async findMany(options: UploadQueryOptions): Promise<{
    uploads: CdnUploadEntity[];
    total: number;
  }> {
    const queryBuilder = this.uploadRepo
      .createQueryBuilder('upload')
      .leftJoinAndSelect('upload.recording', 'recording')
      .leftJoinAndSelect('upload.highlight', 'highlight')
      .leftJoinAndSelect('upload.uploader', 'uploader');

    if (options.recordingId) {
      queryBuilder.andWhere('upload.recordingId = :recordingId', {
        recordingId: options.recordingId,
      });
    }

    if (options.highlightId) {
      queryBuilder.andWhere('upload.highlightId = :highlightId', {
        highlightId: options.highlightId,
      });
    }

    if (options.uploadedBy) {
      queryBuilder.andWhere('upload.uploadedBy = :uploadedBy', {
        uploadedBy: options.uploadedBy,
      });
    }

    if (options.status) {
      queryBuilder.andWhere('upload.status = :status', { status: options.status });
    }

    if (options.type) {
      queryBuilder.andWhere('upload.type = :type', { type: options.type });
    }

    if (options.provider) {
      queryBuilder.andWhere('upload.provider = :provider', { provider: options.provider });
    }

    if (options.region) {
      queryBuilder.andWhere('upload.region = :region', { region: options.region });
    }

    // Sorting
    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder || 'desc';
    queryBuilder.orderBy(`upload.${sortBy}`, sortOrder.toUpperCase() as 'ASC' | 'DESC');

    // Pagination
    const limit = Math.min(options.limit || 50, 100);
    const offset = options.offset || 0;

    const [uploads, total] = await queryBuilder
      .limit(limit)
      .offset(offset)
      .getManyAndCount();

    return { uploads, total };
  }

  async delete(id: string): Promise<void> {
    const upload = await this.findById(id);
    if (!upload) {
      throw new NotFoundError('Upload', id);
    }

    // Don't allow deletion of uploads in progress
    if (upload.status === UploadStatus.UPLOADING || upload.status === UploadStatus.PROCESSING) {
      throw new ValidationError('Cannot delete upload in progress');
    }

    await this.uploadRepo.remove(upload);

    // Remove from cache
    await this.cacheService.delete(`upload:${id}`);
  }

  async getUploadsByRecording(recordingId: string): Promise<CdnUploadEntity[]> {
    const cacheKey = `uploads_recording:${recordingId}`;
    const cached = await this.cacheService.get<CdnUploadEntity[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const uploads = await this.uploadRepo.find({
      where: { recordingId },
      relations: ['uploader'],
      order: { createdAt: 'DESC' },
    });

    // Cache for 5 minutes
    await this.cacheService.set(cacheKey, uploads, 300);

    return uploads;
  }

  async getUploadsByHighlight(highlightId: string): Promise<CdnUploadEntity[]> {
    const cacheKey = `uploads_highlight:${highlightId}`;
    const cached = await this.cacheService.get<CdnUploadEntity[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const uploads = await this.uploadRepo.find({
      where: { highlightId },
      relations: ['uploader'],
      order: { createdAt: 'DESC' },
    });

    // Cache for 5 minutes
    await this.cacheService.set(cacheKey, uploads, 300);

    return uploads;
  }

  async getUploadStats(uploadedBy?: string): Promise<{
    totalUploads: number;
    totalSize: number;
    completedUploads: number;
    failedUploads: number;
    totalBandwidth: number;
    avgUploadSpeed: number;
  }> {
    const queryBuilder = this.uploadRepo.createQueryBuilder('upload');
    
    if (uploadedBy) {
      queryBuilder.where('upload.uploadedBy = :uploadedBy', { uploadedBy });
    }

    const uploads = await queryBuilder.getMany();

    const totalUploads = uploads.length;
    const completedUploads = uploads.filter(u => u.status === UploadStatus.COMPLETED).length;
    const failedUploads = uploads.filter(u => u.status === UploadStatus.FAILED).length;
    
    const totalSize = uploads.reduce(
      (sum, upload) => sum + upload.fileMetadata.size,
      0
    );
    
    const totalBandwidth = uploads.reduce(
      (sum, upload) => sum + upload.analytics.bandwidth,
      0
    );

    const avgUploadSpeed = completedUploads > 0
      ? uploads
          .filter(u => u.uploadMetadata.avgUploadSpeed)
          .reduce((sum, u) => sum + (u.uploadMetadata.avgUploadSpeed || 0), 0) / completedUploads
      : 0;

    return {
      totalUploads,
      totalSize,
      completedUploads,
      failedUploads,
      totalBandwidth,
      avgUploadSpeed,
    };
  }

  private getDefaultBucket(provider: StorageProvider): string {
    const buckets = {
      [StorageProvider.AWS_S3]: 'rbx-streams',
      [StorageProvider.GOOGLE_CLOUD]: 'rbx-streams',
      [StorageProvider.AZURE_BLOB]: 'rbx-streams',
      [StorageProvider.CLOUDFLARE_R2]: 'rbx-streams',
      [StorageProvider.DIGITALOCEAN]: 'rbx-streams',
      [StorageProvider.CUSTOM]: 'custom',
    };
    return buckets[provider] || 'rbx-streams';
  }

  private getDefaultRegion(provider: StorageProvider): string {
    const regions = {
      [StorageProvider.AWS_S3]: 'us-east-1',
      [StorageProvider.GOOGLE_CLOUD]: 'us-central1',
      [StorageProvider.AZURE_BLOB]: 'eastus',
      [StorageProvider.CLOUDFLARE_R2]: 'auto',
      [StorageProvider.DIGITALOCEAN]: 'nyc3',
      [StorageProvider.CUSTOM]: 'global',
    };
    return regions[provider] || 'global';
  }

  private generateProviderSignedUrl(upload: CdnUploadEntity, expiryMinutes: number): string {
    // This would integrate with actual CDN provider SDKs
    // For now, return a mock signed URL
    const baseUrl = upload.cdnUrl || `https://${upload.storageMetadata.bucket}.${upload.storageMetadata.provider}.com`;
    const expires = new Date(Date.now() + expiryMinutes * 60 * 1000).getTime();
    const signature = 'mock-signature';
    
    return `${baseUrl}/${upload.filePath}?expires=${expires}&signature=${signature}`;
  }
}
