import { Repository, DataSource } from 'typeorm';
import { Injectable } from '@nestjs/common';
import {
  StreamSessionEntity,
  StreamStatus,
  StreamType,
  StreamQuality,
  TournamentEntity,
  MatchEntity,
  UserEntity,
} from '../database/entities';
import { NotFoundError, ValidationError } from './errors';
import { CacheService } from './cache.service';
import { NotificationService } from './notification.service';

export interface CreateStreamSessionInput {
  tournamentId?: string;
  matchId?: string;
  streamerId: string;
  type: StreamType;
  title: string;
  description?: string;
  quality?: StreamQuality;
  scheduledFor?: Date;
  metadata?: {
    platform: string;
    platformStreamId?: string;
    platformSettings?: Record<string, any>;
    recordingEnabled?: boolean;
    autoHighlightEnabled?: boolean;
    tags?: string[];
    language?: string;
  };
  region?: string;
}

export interface UpdateStreamSessionInput {
  title?: string;
  description?: string;
  quality?: StreamQuality;
  metadata?: Record<string, any>;
  scheduledFor?: Date;
}

export interface StreamSessionQueryOptions {
  tournamentId?: string;
  matchId?: string;
  streamerId?: string;
  type?: StreamType;
  status?: StreamStatus;
  region?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'startedAt' | 'viewerCount' | 'maxViewers';
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class StreamSessionService {
  constructor(
    private readonly streamSessionRepo: Repository<StreamSessionEntity>,
    private readonly tournamentRepo: Repository<TournamentEntity>,
    private readonly matchRepo: Repository<MatchEntity>,
    private readonly userRepo: Repository<UserEntity>,
    private readonly dataSource: DataSource,
    private readonly cacheService: CacheService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(input: CreateStreamSessionInput): Promise<StreamSessionEntity> {
    // Validate streamer exists
    const streamer = await this.userRepo.findOne({ where: { id: input.streamerId } });
    if (!streamer) {
      throw new NotFoundError('Streamer', input.streamerId);
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

    // Validate match if provided
    if (input.matchId) {
      const match = await this.matchRepo.findOne({ 
        where: { id: input.matchId } 
      });
      if (!match) {
        throw new NotFoundError('Match', input.matchId);
      }
    }

    const streamSession = this.streamSessionRepo.create({
      ...input,
      status: StreamStatus.PENDING,
      quality: input.quality || StreamQuality.AUTO,
      metadata: {
        platform: input.metadata?.platform || 'custom',
        platformStreamId: input.metadata?.platformStreamId,
        platformSettings: input.metadata?.platformSettings || {},
        recordingEnabled: input.metadata?.recordingEnabled ?? true,
        autoHighlightEnabled: input.metadata?.autoHighlightEnabled ?? true,
        tags: input.metadata?.tags || [],
        language: input.metadata?.language,
      },
      region: input.region || 'global',
    });

    const savedSession = await this.streamSessionRepo.save(streamSession);

    // Cache the session
    await this.cacheService.set(
      `stream_session:${savedSession.id}`,
      savedSession,
      3600 // 1 hour
    );

    // Send notification to streamer
    await this.notificationService.create({
      userId: input.streamerId,
      templateKey: 'stream_session_created',
      channel: 'inApp',
      payload: {
        sessionId: savedSession.id,
        title: savedSession.title,
        type: savedSession.type,
        scheduledFor: savedSession.scheduledFor,
      },
    });

    return savedSession;
  }

  async findById(id: string): Promise<StreamSessionEntity | null> {
    // Try cache first
    const cached = await this.cacheService.get<StreamSessionEntity>(
      `stream_session:${id}`
    );
    if (cached) {
      return cached;
    }

    const session = await this.streamSessionRepo.findOne({
      where: { id },
      relations: ['streamer', 'tournament', 'match'],
    });

    if (session) {
      await this.cacheService.set(`stream_session:${id}`, session, 3600);
    }

    return session;
  }

  async update(
    id: string,
    input: UpdateStreamSessionInput
  ): Promise<StreamSessionEntity> {
    const session = await this.findById(id);
    if (!session) {
      throw new NotFoundError('Stream session', id);
    }

    // Don't allow updates if stream is live
    if (session.status === StreamStatus.LIVE) {
      throw new ValidationError('Cannot update live stream session');
    }

    Object.assign(session, input);

    const updatedSession = await this.streamSessionRepo.save(session);

    // Update cache
    await this.cacheService.set(
      `stream_session:${id}`,
      updatedSession,
      3600
    );

    return updatedSession;
  }

  async startStream(id: string): Promise<StreamSessionEntity> {
    const session = await this.findById(id);
    if (!session) {
      throw new NotFoundError('Stream session', id);
    }

    if (session.status !== StreamStatus.PENDING) {
      throw new ValidationError('Stream session is not in pending status');
    }

    session.status = StreamStatus.LIVE;
    session.startedAt = new Date();

    const updatedSession = await this.streamSessionRepo.save(session);

    // Update cache
    await this.cacheService.set(
      `stream_session:${id}`,
      updatedSession,
      3600
    );

    // Send stream start notification
    await this.notificationService.create({
      userId: session.streamerId,
      templateKey: 'stream_started',
      channel: 'inApp',
      payload: {
        sessionId: session.id,
        title: session.title,
        startedAt: session.startedAt,
      },
    });

    return updatedSession;
  }

  async endStream(id: string, reason?: string): Promise<StreamSessionEntity> {
    const session = await this.findById(id);
    if (!session) {
      throw new NotFoundError('Stream session', id);
    }

    if (session.status !== StreamStatus.LIVE) {
      throw new ValidationError('Stream session is not live');
    }

    session.status = StreamStatus.ENDED;
    session.endedAt = new Date();

    // Update stream stats
    if (session.startedAt) {
      const duration = Math.floor(
        (session.endedAt.getTime() - session.startedAt.getTime()) / 1000
      );
      session.streamStats = {
        ...session.streamStats,
        duration,
        avgViewers: session.viewerCount || 0,
        peakViewers: session.maxViewers,
      };
    }

    const updatedSession = await this.streamSessionRepo.save(session);

    // Update cache
    await this.cacheService.set(
      `stream_session:${id}`,
      updatedSession,
      3600
    );

    // Send stream end notification
    await this.notificationService.create({
      userId: session.streamerId,
      templateKey: 'stream_ended',
      channel: 'inApp',
      payload: {
        sessionId: session.id,
        title: session.title,
        endedAt: session.endedAt,
        duration: session.streamStats.duration,
        reason,
      },
    });

    return updatedSession;
  }

  async updateViewerCount(id: string, viewerCount: number): Promise<void> {
    const session = await this.findById(id);
    if (!session) {
      throw new NotFoundError('Stream session', id);
    }

    session.viewerCount = viewerCount;
    session.maxViewers = Math.max(session.maxViewers, viewerCount);

    await this.streamSessionRepo.save(session);

    // Update cache
    await this.cacheService.set(
      `stream_session:${id}`,
      session,
      3600
    );
  }

  async addHighlightMarker(
    id: string,
    marker: {
      timestamp: number;
      type: 'kill' | 'death' | 'win' | 'clutch' | 'ace' | 'multikill' | 'custom';
      description: string;
      confidence?: number;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    const session = await this.findById(id);
    if (!session) {
      throw new NotFoundError('Stream session', id);
    }

    session.highlightMarkers.push(marker);

    await this.streamSessionRepo.save(session);

    // Update cache
    await this.cacheService.set(
      `stream_session:${id}`,
      session,
      3600
    );
  }

  async findMany(options: StreamSessionQueryOptions): Promise<{
    sessions: StreamSessionEntity[];
    total: number;
  }> {
    const queryBuilder = this.streamSessionRepo
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.streamer', 'streamer')
      .leftJoinAndSelect('session.tournament', 'tournament')
      .leftJoinAndSelect('session.match', 'match');

    if (options.tournamentId) {
      queryBuilder.andWhere('session.tournamentId = :tournamentId', {
        tournamentId: options.tournamentId,
      });
    }

    if (options.matchId) {
      queryBuilder.andWhere('session.matchId = :matchId', {
        matchId: options.matchId,
      });
    }

    if (options.streamerId) {
      queryBuilder.andWhere('session.streamerId = :streamerId', {
        streamerId: options.streamerId,
      });
    }

    if (options.type) {
      queryBuilder.andWhere('session.type = :type', { type: options.type });
    }

    if (options.status) {
      queryBuilder.andWhere('session.status = :status', { status: options.status });
    }

    if (options.region) {
      queryBuilder.andWhere('session.region = :region', { region: options.region });
    }

    // Sorting
    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder || 'desc';
    queryBuilder.orderBy(`session.${sortBy}`, sortOrder.toUpperCase() as 'ASC' | 'DESC');

    // Pagination
    const limit = Math.min(options.limit || 50, 100);
    const offset = options.offset || 0;

    const [sessions, total] = await queryBuilder
      .limit(limit)
      .offset(offset)
      .getManyAndCount();

    return { sessions, total };
  }

  async delete(id: string): Promise<void> {
    const session = await this.findById(id);
    if (!session) {
      throw new NotFoundError('Stream session', id);
    }

    // Don't allow deletion of live streams
    if (session.status === StreamStatus.LIVE) {
      throw new ValidationError('Cannot delete live stream session');
    }

    await this.streamSessionRepo.remove(session);

    // Remove from cache
    await this.cacheService.delete(`stream_session:${id}`);
  }

  async getActiveStreams(): Promise<StreamSessionEntity[]> {
    const cacheKey = 'active_streams';
    const cached = await this.cacheService.get<StreamSessionEntity[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const sessions = await this.streamSessionRepo.find({
      where: { status: StreamStatus.LIVE },
      relations: ['streamer', 'tournament', 'match'],
      order: { startedAt: 'DESC' },
    });

    // Cache for 5 minutes
    await this.cacheService.set(cacheKey, sessions, 300);

    return sessions;
  }

  async getStreamerStats(streamerId: string): Promise<{
    totalSessions: number;
    totalDuration: number;
    totalViews: number;
    avgViewers: number;
    maxViewers: number;
  }> {
    const sessions = await this.streamSessionRepo.find({
      where: { streamerId, status: StreamStatus.ENDED },
      select: ['streamStats', 'maxViewers'],
    });

    const totalSessions = sessions.length;
    const totalDuration = sessions.reduce(
      (sum, session) => sum + (session.streamStats.duration || 0),
      0
    );
    const totalViews = sessions.reduce(
      (sum, session) => sum + (session.streamStats.totalViews || 0),
      0
    );
    const maxViewers = Math.max(...sessions.map(s => s.maxViewers), 0);
    const avgViewers = totalSessions > 0 ? totalViews / totalSessions : 0;

    return {
      totalSessions,
      totalDuration,
      totalViews,
      avgViewers,
      maxViewers,
    };
  }
}
