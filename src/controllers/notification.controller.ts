import { Router } from 'express';
import { ServiceContainer } from '../services/service-factory';
import { asyncHandler, sendSuccess } from './http-utils';
import { validateDto } from './dto/utils';
import { CreateNotificationDto, QueueNotificationDto, UpdateNotificationDto } from './dto/notification.dto';
import { getPaginationParams } from './query-utils';
import { NotificationEntity } from '../database/entities/notification.entity';
import { UserRole } from '../database/entities/user.entity';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { assertSelfOrAdmin } from './guards';

const CHANNELS: NotificationEntity['channel'][] = ['fcm', 'inApp', 'sms', 'email'];
const STATUSES: NotificationEntity['status'][] = ['queued', 'sent', 'delivered', 'failed', 'read'];

function coerceChannel(value: unknown): NotificationEntity['channel'] | undefined {
  return typeof value === 'string' && CHANNELS.includes(value as NotificationEntity['channel'])
    ? (value as NotificationEntity['channel'])
    : undefined;
}

function coerceStatus(value: unknown): NotificationEntity['status'] | undefined {
  return typeof value === 'string' && STATUSES.includes(value as NotificationEntity['status'])
    ? (value as NotificationEntity['status'])
    : undefined;
}

export function createNotificationController(services: ServiceContainer): Router {
  const router = Router();
  const auth = requireAuth(services);
  const adminOnly = requireRole(services, 'admin');

  router.post(
    '/',
    ...adminOnly,
    asyncHandler(async (req, res) => {
      const dto = await validateDto(CreateNotificationDto, req.body);
      const notification = await services.notificationService.create(dto);
      return sendSuccess(res, notification, 201);
    }),
  );

  router.post(
    '/queue',
    ...adminOnly,
    asyncHandler(async (req, res) => {
      const dto = await validateDto(QueueNotificationDto, req.body);
      const notification = await services.notificationService.queue(dto.userId, dto.templateKey, dto.channel, dto.payload, {
        tournamentId: dto.tournamentId,
        matchId: dto.matchId,
      });
      return sendSuccess(res, notification, 201);
    }),
  );

  router.get(
    '/',
    auth,
    asyncHandler(async (req, res) => {
      const { page, limit } = getPaginationParams(req);
      const filters: { userId?: string; status?: NotificationEntity['status']; channel?: NotificationEntity['channel'] } = {};
      if (req.query.userId) filters.userId = String(req.query.userId);
      const status = coerceStatus(req.query.status);
      if (status) filters.status = status;
      const channel = coerceChannel(req.query.channel);
      if (channel) filters.channel = channel;
      if (req.user?.role !== UserRole.ADMIN) {
        filters.userId = req.user?.id;
      }
      const notifications = await services.notificationService.list({ page, limit, filters });
      return sendSuccess(res, notifications);
    }),
  );

  router.patch(
    '/:id',
    ...adminOnly,
    asyncHandler(async (req, res) => {
      const dto = await validateDto(UpdateNotificationDto, req.body);
      const notification = await services.notificationService.update(req.params.id, dto);
      return sendSuccess(res, notification);
    }),
  );

  router.delete(
    '/:id',
    ...adminOnly,
    asyncHandler(async (req, res) => {
      await services.notificationService.delete(req.params.id);
      return sendSuccess(res, { id: req.params.id, deleted: true });
    }),
  );

  router.post(
    '/:id/mark-sent',
    ...adminOnly,
    asyncHandler(async (req, res) => {
      const notification = await services.notificationService.markSent(req.params.id);
      return sendSuccess(res, notification);
    }),
  );

  router.post(
    '/:id/mark-delivered',
    ...adminOnly,
    asyncHandler(async (req, res) => {
      const notification = await services.notificationService.markDelivered(req.params.id);
      return sendSuccess(res, notification);
    }),
  );

  router.post(
    '/:id/mark-read',
    auth,
    asyncHandler(async (req, res) => {
      const notification = await services.notificationService.findById(req.params.id);
      assertSelfOrAdmin(req, notification.user.id, 'You may only update your own notifications.');
      const updated = await services.notificationService.markRead(req.params.id);
      return sendSuccess(res, updated);
    }),
  );

  router.get(
    '/user/:userId',
    auth,
    asyncHandler(async (req, res) => {
      assertSelfOrAdmin(req, req.params.userId, 'You may only view your own notifications.');
      const { page, limit } = getPaginationParams(req);
      const notifications = await services.notificationService.listByUser(req.params.userId, { page, limit });
      return sendSuccess(res, notifications);
    }),
  );

  router.get(
    '/:id',
    auth,
    asyncHandler(async (req, res) => {
      const notification = await services.notificationService.findById(req.params.id);
      assertSelfOrAdmin(req, notification.user.id, 'You may only view your own notifications.');
      return sendSuccess(res, notification);
    }),
  );

  return router;
}
