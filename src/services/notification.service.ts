import { EntityManager, Repository } from 'typeorm';
import { NotificationEntity, UserEntity, TournamentEntity, MatchEntity } from '../database/entities';
import { ListOptions, PaginatedResult } from './types';
import { NotFoundError, ValidationError } from './errors';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CreateNotificationInput {
  userId: string;
  templateKey: string;
  channel: NotificationEntity['channel'];
  payload: Record<string, unknown>;
  status?: NotificationEntity['status'];
  sentAt?: Date | null;
  deliveredAt?: Date | null;
  readAt?: Date | null;
  errorMessage?: string | null;
  tournamentId?: string;
  matchId?: string;
}

export interface QueueNotificationOptions {
  tournamentId?: string;
  matchId?: string;
}

export interface UpdateNotificationInput {
  templateKey?: string;
  payload?: Record<string, unknown>;
  errorMessage?: string | null;
}

export class NotificationService {
  constructor(
    private readonly notificationRepo: Repository<NotificationEntity>,
    private readonly userRepo: Repository<UserEntity>,
    private readonly tournamentRepo: Repository<TournamentEntity>,
    private readonly matchRepo: Repository<MatchEntity>,
  ) {}

  async create(input: CreateNotificationInput): Promise<NotificationEntity> {
    await this.ensureUser(input.userId);
    const tournament = input.tournamentId ? await this.ensureTournament(input.tournamentId) : null;
    const match = input.matchId ? await this.ensureMatch(input.matchId) : null;

    this.validatePayload(input.templateKey, input.payload);

    const notification = this.notificationRepo.create({
      user: { id: input.userId } as UserEntity,
      templateKey: input.templateKey,
      channel: input.channel,
      payload: input.payload,
      status: input.status ?? 'queued',
      sentAt: input.sentAt ?? null,
      deliveredAt: input.deliveredAt ?? null,
      readAt: input.readAt ?? null,
      errorMessage: input.errorMessage ?? null,
      tournament: tournament ?? null,
      match: match ?? null,
    });

    return this.notificationRepo.save(notification);
  }

  async queue(
    userId: string,
    templateKey: string,
    channel: NotificationEntity['channel'],
    payload: Record<string, unknown>,
    options: QueueNotificationOptions = {},
  ): Promise<NotificationEntity> {
    return this.create({
      userId,
      templateKey,
      channel,
      payload,
      tournamentId: options.tournamentId,
      matchId: options.matchId,
      status: 'queued',
    });
  }

  async findById(id: string): Promise<NotificationEntity> {
    this.assertValidUuid(id, 'Notification');
    const notification = await this.notificationRepo.findOne({ where: { id }, relations: ['user'] });
    if (!notification) {
      throw new NotFoundError('Notification', id);
    }
    return notification;
  }

  async update(id: string, input: UpdateNotificationInput): Promise<NotificationEntity> {
    const notification = await this.findById(id);
    if (input.templateKey) {
      this.validatePayload(input.templateKey, input.payload ?? notification.payload);
    }
    if (input.payload) {
      this.validatePayload(notification.templateKey, input.payload);
    }
    this.notificationRepo.merge(notification, input);
    return this.notificationRepo.save(notification);
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
    await this.notificationRepo.softDelete(id);
  }

  async list(
    options: ListOptions<{ userId?: string; status?: NotificationEntity['status']; channel?: NotificationEntity['channel'] }> = {},
  ): Promise<PaginatedResult<NotificationEntity>> {
    const { page = 1, limit = 25, filters = {}, sort } = options;
    const where: Record<string, unknown> = {};
    if (filters.userId) where.user = { id: filters.userId };
    if (filters.status) where.status = filters.status;
    if (filters.channel) where.channel = filters.channel;

    const [data, total] = await this.notificationRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: sort ?? { createdAt: 'DESC' },
    });

    return { data, total, page, limit };
  }

  async markSent(notificationId: string, sentAt: Date = new Date()): Promise<NotificationEntity> {
    return this.transition(notificationId, 'queued', 'sent', manager => {
      const repo = manager.getRepository(NotificationEntity);
      return repo.save({ id: notificationId, status: 'sent', sentAt });
    });
  }

  async markDelivered(notificationId: string, deliveredAt: Date = new Date()): Promise<NotificationEntity> {
    return this.transition(notificationId, 'sent', 'delivered', manager => {
      const repo = manager.getRepository(NotificationEntity);
      return repo.save({ id: notificationId, status: 'delivered', deliveredAt });
    });
  }

  async markRead(notificationId: string, readAt: Date = new Date()): Promise<NotificationEntity> {
    const notification = await this.findById(notificationId);
    if (notification.status === 'read') {
      return notification;
    }
    if (!['delivered', 'sent', 'queued'].includes(notification.status)) {
      throw new ValidationError('Cannot mark notification as read from current status.');
    }
    notification.status = 'read';
    notification.readAt = readAt;
    return this.notificationRepo.save(notification);
  }

  async listByUser(
    userId: string,
    options: ListOptions<{ status?: NotificationEntity['status'] }> = {},
  ): Promise<PaginatedResult<NotificationEntity>> {
    const filters = { ...(options.filters ?? {}), userId };
    return this.list({ ...options, filters });
  }

  private async transition(
    notificationId: string,
    requiredStatus: NotificationEntity['status'],
    nextStatus: NotificationEntity['status'],
    mutator: (manager: EntityManager) => Promise<NotificationEntity>,
  ) {
    return this.notificationRepo.manager.transaction(async (manager: EntityManager) => {
      const repo = manager.getRepository(NotificationEntity);
      const notification = await repo.findOne({ where: { id: notificationId } });
      if (!notification) {
        throw new NotFoundError('Notification', notificationId);
      }
      if (notification.status !== requiredStatus) {
        throw new ValidationError(`Notification must be ${requiredStatus} before transitioning to ${nextStatus}.`);
      }
      const updated = await mutator(manager);
      return repo.findOneOrFail({ where: { id: updated.id } });
    });
  }

  private async ensureUser(id: string) {
    this.assertValidUuid(id, 'User');
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundError('User', id);
    }
  }

  private async ensureTournament(id: string) {
    this.assertValidUuid(id, 'Tournament');
    const tournament = await this.tournamentRepo.findOne({ where: { id } });
    if (!tournament) {
      throw new NotFoundError('Tournament', id);
    }
    return tournament;
  }

  private async ensureMatch(id: string) {
    this.assertValidUuid(id, 'Match');
    const match = await this.matchRepo.findOne({ where: { id } });
    if (!match) {
      throw new NotFoundError('Match', id);
    }
    return match;
  }

  private validatePayload(templateKey: string, payload: Record<string, unknown>) {
    if (!templateKey) {
      throw new ValidationError('templateKey is required.');
    }
    if (!payload || typeof payload !== 'object') {
      throw new ValidationError('payload must be an object.');
    }
  }

  private assertValidUuid(value: string, entityName: string) {
    if (!UUID_REGEX.test(value)) {
      throw new NotFoundError(entityName, value);
    }
  }
}
