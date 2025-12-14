import { Repository, DataSource } from 'typeorm';
import { Injectable } from '@nestjs/common';
import {
  RecordingEntity,
  RecordingStatus,
  RecordingFormat,
  RecordingQuality,
  StreamSessionEntity,
  MatchEntity,
  TournamentEntity,
  UserEntity,
} from '../database/entities';
import { NotFoundError, ValidationError } from './errors';
import { CacheService } from './cache.service';
import { NotificationService } from './notification.service';

export interface CreateRecordingInput {
  streamSessionId: string;
  matchId?: string;
  tournamentId?: string;
  recordedBy: string;
  title: string;
  description?: string;
  format?: RecordingFormat;
  quality?: RecordingQuality;
  metadata?: {
    platform?: string;
    platformRecordingId?: string;
    tags?: string[];
    language?: string;
    region?: string;
    autoRecorded?: boolean;
    backupEnabled?: boolean;
    priority?: number;
  };
  region?: string;
}

export interface UpdateRecordingInput {
  title?: string;
  description?: string;
  metadata?: Record<string, any>;
  expiresAt?: Date;
}

export interface RecordingQueryOptions {
  streamSessionId?: string;
  matchId?: string;
  tournamentId?: string;
  recordedBy?: string;
  status?: RecordingStatus;
  format?: RecordingFormat;
  quality?: RecordingQuality;
  region?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'startedAt' | 'duration' | 'views';
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class RecordingService {
  constructor(
    private readonly recordingRepo: Repository<RecordingEntity>,
    private readonly streamSessionRepo: Repository<StreamSessionEntity>,
    private readonly matchRepo: Repository<MatchEntity>,
    private readonly tournamentRepo: Repository<TournamentEntity>,
    private readonly userRepo: Repository<UserEntity>,
    private readonly dataSource: DataSource,
    private readonly cacheService: CacheService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(input: CreateRecordingInput): Promise<RecordingEntity> {
    // Validate stream session exists
    const streamSession = await this.streamSessionRepo.findOne({ 
      where: { id: input.streamSessionId } 
    });
    if (!streamSession) {
      throw new NotFoundError('Stream session', input.streamSessionId);
    }

    // Validate recorder exists
    const recorder = await this.userRepo.findOne({ 
      where: { id: input.recordedBy } 
    });
    if (!recorder) {
      throw new NotFoundError('Recorder', input.recordedBy);
    }

    // Validate match if provided
    if (input.matchId) {
      const match = await this.matchRepo.findOne({ 
        where: { id: input.matchId } 
      });
      if (!match) {
        throw new NotFoundError('Match', input.matchId);
      }
    }

    // Validate tournament if provided
    if (input.tournamentId) {
      const tournament = await this.tournamentRepo.findOne({ 
        where: { id: input.tournamentId } 
      });
      if (!tournament) {
        throw new NotFoundError('Tournament', input.tournamentId);
      }
    }

    const recording = this.recordingRepo.create({
      ...input,
      status: RecordingStatus.INITIALIZING,
      format: input.format || RecordingFormat.MP4,
      quality: input.quality || RecordingQuality.HIGH,
      metadata: {
        platform: input.metadata?.platform || 'custom',
        platformRecordingId: input.metadata?.platformRecordingId,
        tags: input.metadata?.tags || [],
        language: input.metadata?.language,
        region: input.metadata?.region,
        autoRecorded: input.metadata?.autoRecorded ?? true,
        backupEnabled: input.metadata?.backupEnabled ?? true,
        priority: input.metadata?.priority || 0,
      },
      region: input.region || 'global',
    });

    const savedRecording = await this.recordingRepo.save(recording);

    // Cache the recording
    await this.cacheService.set(
      `recording:${savedRecording.id}`,
      savedRecording,
      3600 // 1 hour
    );

    // Send notification to recorder
    await this.notificationService.create({
      userId: input.recordedBy,
      templateKey: 'recording_initialized',
      channel: 'inApp',
      payload: {
        recordingId: savedRecording.id,
        title: savedRecording.title,
        streamSessionId: savedRecording.streamSessionId,
      },
    });

    return savedRecording;
  }

  async findById(id: string): Promise<RecordingEntity | null> {
    // Try cache first
    const cached = await this.cacheService.get<RecordingEntity>(
      `recording:${id}`
    );
    if (cached) {
      return cached;
    }

    const recording = await this.recordingRepo.findOne({
      where: { id },
      relations: ['streamSession', 'match', 'tournament', 'recorder'],
    });

    if (recording) {
      await this.cacheService.set(`recording:${id}`, recording, 3600);
    }

    return recording;
  }

  async update(
    id: string,
    input: UpdateRecordingInput
  ): Promise<RecordingEntity> {
    const recording = await this.findById(id);
    if (!recording) {
      throw new NotFoundError('Recording', id);
    }

    // Don't allow updates if recording is in progress
    if (recording.status === RecordingStatus.RECORDING) {
      throw new ValidationError('Cannot update recording in progress');
    }

    Object.assign(recording, input);

    const updatedRecording = await this.recordingRepo.save(recording);

    // Update cache
    await this.cacheService.set(
      `recording:${id}`,
      updatedRecording,
      3600
    );

    return updatedRecording;
  }

  async startRecording(id: string): Promise<RecordingEntity> {
    const recording = await this.findById(id);
    if (!recording) {
      throw new NotFoundError('Recording', id);
    }

    if (recording.status !== RecordingStatus.INITIALIZING) {
      throw new ValidationError('Recording is not in initializing status');
    }

    recording.status = RecordingStatus.RECORDING;
    recording.startedAt = new Date();
    recording.processingMetadata = {
      ...recording.processingMetadata,
      processingStartedAt: new Date(),
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
    };

    const updatedRecording = await this.recordingRepo.save(recording);

    // Update cache
    await this.cacheService.set(
      `recording:${id}`,
      updatedRecording,
      3600
    );

    // Send notification
    await this.notificationService.create({
      userId: recording.recordedBy,
      templateKey: 'recording_started',
      channel: 'inApp',
      payload: {
        recordingId: recording.id,
        title: recording.title,
        startedAt: recording.startedAt,
      },
    });

    return updatedRecording;
  }

  async stopRecording(id: string): Promise<RecordingEntity> {
    const recording = await this.findById(id);
    if (!recording) {
      throw new NotFoundError('Recording', id);
    }

    if (recording.status !== RecordingStatus.RECORDING) {
      throw new ValidationError('Recording is not in recording status');
    }

    recording.status = RecordingStatus.PROCESSING;
    recording.endedAt = new Date();

    // Update recording metadata
    if (recording.startedAt) {
      const duration = Math.floor(
        (recording.endedAt.getTime() - recording.startedAt.getTime()) / 1000
      );
      recording.recordingMetadata = {
        ...recording.recordingMetadata,
        startedAt: recording.startedAt,
        endedAt: recording.endedAt,
        duration,
      };
    }

    recording.processingMetadata = {
      ...recording.processingMetadata,
      processingCompletedAt: new Date(),
      processingSteps: recording.processingMetadata.processingSteps.map(step => 
        step.step === 'recording' 
          ? { ...step, completedAt: new Date(), status: 'completed' as const }
          : step
      ).concat([
        {
          step: 'processing',
          startedAt: new Date(),
          status: 'processing' as const,
        },
      ]),
    };

    const updatedRecording = await this.recordingRepo.save(recording);

    // Update cache
    await this.cacheService.set(
      `recording:${id}`,
      updatedRecording,
      3600
    );

    // Send notification
    await this.notificationService.create({
      userId: recording.recordedBy,
      templateKey: 'recording_stopped',
      channel: 'inApp',
      payload: {
        recordingId: recording.id,
        title: recording.title,
        endedAt: recording.endedAt,
        duration: recording.recordingMetadata.duration,
      },
    });

    return updatedRecording;
  }

  async completeRecording(
    id: string,
    videoData: {
      videoUrl: string;
      downloadUrl: string;
      thumbnailUrl?: string;
      previewUrl?: string;
      videoMetadata: {
        resolution: string;
        fps: number;
        bitrate: number;
        codec: string;
        aspectRatio: string;
        fileSize: number;
        duration: number;
        audioCodec?: string;
        audioBitrate?: number;
      };
    }
  ): Promise<RecordingEntity> {
    const recording = await this.findById(id);
    if (!recording) {
      throw new NotFoundError('Recording', id);
    }

    if (recording.status !== RecordingStatus.PROCESSING) {
      throw new ValidationError('Recording is not in processing status');
    }

    recording.status = RecordingStatus.COMPLETED;
    recording.videoUrl = videoData.videoUrl;
    recording.downloadUrl = videoData.downloadUrl;
    recording.thumbnailUrl = videoData.thumbnailUrl;
    recording.previewUrl = videoData.previewUrl;
    recording.videoMetadata = videoData.videoMetadata;

    recording.processingMetadata = {
      ...recording.processingMetadata,
      processingCompletedAt: new Date(),
      processingSteps: recording.processingMetadata.processingSteps.map(step => 
        step.step === 'processing' 
          ? { ...step, completedAt: new Date(), status: 'completed' as const }
          : step
      ),
    };

    const updatedRecording = await this.recordingRepo.save(recording);

    // Update cache
    await this.cacheService.set(
      `recording:${id}`,
      updatedRecording,
      3600
    );

    // Send notification
    await this.notificationService.create({
      userId: recording.recordedBy,
      templateKey: 'recording_completed',
      channel: 'inApp',
      payload: {
        recordingId: recording.id,
        title: recording.title,
        videoUrl: recording.videoUrl,
        duration: recording.videoMetadata.duration,
        fileSize: recording.videoMetadata.fileSize,
      },
    });

    return updatedRecording;
  }

  async failRecording(id: string, errorMessage: string): Promise<RecordingEntity> {
    const recording = await this.findById(id);
    if (!recording) {
      throw new NotFoundError('Recording', id);
    }

    recording.status = RecordingStatus.FAILED;
    recording.errorMessage = errorMessage;
    recording.endedAt = new Date();

    recording.processingMetadata = {
      ...recording.processingMetadata,
      processingCompletedAt: new Date(),
      processingSteps: recording.processingMetadata.processingSteps.map(step => 
        step.status === 'processing' 
          ? { ...step, completedAt: new Date(), status: 'failed' as const, error: errorMessage }
          : step
      ),
    };

    const updatedRecording = await this.recordingRepo.save(recording);

    // Update cache
    await this.cacheService.set(
      `recording:${id}`,
      updatedRecording,
      3600
    );

    // Send notification
    await this.notificationService.create({
      userId: recording.recordedBy,
      templateKey: 'recording_failed',
      channel: 'inApp',
      payload: {
        recordingId: recording.id,
        title: recording.title,
        errorMessage,
      },
    });

    return updatedRecording;
  }

  async addClipMarker(
    id: string,
    marker: {
      id: string;
      timestamp: number;
      type: 'highlight' | 'event' | 'manual';
      title: string;
      description?: string;
      confidence?: number;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    const recording = await this.findById(id);
    if (!recording) {
      throw new NotFoundError('Recording', id);
    }

    recording.clipMarkers.push(marker);

    await this.recordingRepo.save(recording);

    // Update cache
    await this.cacheService.set(
      `recording:${id}`,
      recording,
      3600
    );
  }

  async findMany(options: RecordingQueryOptions): Promise<{
    recordings: RecordingEntity[];
    total: number;
  }> {
    const queryBuilder = this.recordingRepo
      .createQueryBuilder('recording')
      .leftJoinAndSelect('recording.streamSession', 'streamSession')
      .leftJoinAndSelect('recording.match', 'match')
      .leftJoinAndSelect('recording.tournament', 'tournament')
      .leftJoinAndSelect('recording.recorder', 'recorder');

    if (options.streamSessionId) {
      queryBuilder.andWhere('recording.streamSessionId = :streamSessionId', {
        streamSessionId: options.streamSessionId,
      });
    }

    if (options.matchId) {
      queryBuilder.andWhere('recording.matchId = :matchId', {
        matchId: options.matchId,
      });
    }

    if (options.tournamentId) {
      queryBuilder.andWhere('recording.tournamentId = :tournamentId', {
        tournamentId: options.tournamentId,
      });
    }

    if (options.recordedBy) {
      queryBuilder.andWhere('recording.recordedBy = :recordedBy', {
        recordedBy: options.recordedBy,
      });
    }

    if (options.status) {
      queryBuilder.andWhere('recording.status = :status', { status: options.status });
    }

    if (options.format) {
      queryBuilder.andWhere('recording.format = :format', { format: options.format });
    }

    if (options.quality) {
      queryBuilder.andWhere('recording.quality = :quality', { quality: options.quality });
    }

    if (options.region) {
      queryBuilder.andWhere('recording.region = :region', { region: options.region });
    }

    // Sorting
    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder || 'desc';
    queryBuilder.orderBy(`recording.${sortBy}`, sortOrder.toUpperCase() as 'ASC' | 'DESC');

    // Pagination
    const limit = Math.min(options.limit || 50, 100);
    const offset = options.offset || 0;

    const [recordings, total] = await queryBuilder
      .limit(limit)
      .offset(offset)
      .getManyAndCount();

    return { recordings, total };
  }

  async delete(id: string): Promise<void> {
    const recording = await this.findById(id);
    if (!recording) {
      throw new NotFoundError('Recording', id);
    }

    // Don't allow deletion of recordings in progress
    if (recording.status === RecordingStatus.RECORDING || recording.status === RecordingStatus.PROCESSING) {
      throw new ValidationError('Cannot delete recording in progress');
    }

    await this.recordingRepo.remove(recording);

    // Remove from cache
    await this.cacheService.delete(`recording:${id}`);
  }

  async getRecordingsByStream(streamSessionId: string): Promise<RecordingEntity[]> {
    const cacheKey = `recordings_stream:${streamSessionId}`;
    const cached = await this.cacheService.get<RecordingEntity[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const recordings = await this.recordingRepo.find({
      where: { streamSessionId },
      relations: ['recorder'],
      order: { createdAt: 'DESC' },
    });

    // Cache for 5 minutes
    await this.cacheService.set(cacheKey, recordings, 300);

    return recordings;
  }

  async getRecordingStats(recordedBy?: string): Promise<{
    totalRecordings: number;
    totalDuration: number;
    totalSize: number;
    avgDuration: number;
    completedRecordings: number;
    failedRecordings: number;
  }> {
    const queryBuilder = this.recordingRepo.createQueryBuilder('recording');
    
    if (recordedBy) {
      queryBuilder.where('recording.recordedBy = :recordedBy', { recordedBy });
    }

    const recordings = await queryBuilder.getMany();

    const totalRecordings = recordings.length;
    const completedRecordings = recordings.filter(r => r.status === RecordingStatus.COMPLETED).length;
    const failedRecordings = recordings.filter(r => r.status === RecordingStatus.FAILED).length;
    
    const totalDuration = recordings.reduce(
      (sum, recording) => sum + (recording.recordingMetadata.duration || 0),
      0
    );
    
    const totalSize = recordings.reduce(
      (sum, recording) => sum + (recording.videoMetadata.fileSize || 0),
      0
    );

    const avgDuration = totalRecordings > 0 ? totalDuration / totalRecordings : 0;

    return {
      totalRecordings,
      totalDuration,
      totalSize,
      avgDuration,
      completedRecordings,
      failedRecordings,
    };
  }
}
