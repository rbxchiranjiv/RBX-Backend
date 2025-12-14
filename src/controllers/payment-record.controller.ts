import { Router } from 'express';
import { ServiceContainer } from '../services/service-factory';
import { asyncHandler, sendSuccess } from './http-utils';
import { getPaginationParams } from './query-utils';
import { validateDto } from './dto/utils';
import {
  CreatePaymentRecordDto,
  RecordLedgerDto,
  UpdatePaymentRecordDto,
  UpdatePaymentRecordStatusDto,
} from './dto/payment-record.dto';
import { PaymentRecordEntity } from '../database/entities/payment-record.entity';
import { UserRole } from '../database/entities/user.entity';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { assertSelfOrAdmin } from './guards';
import { AuthorizationError } from '../services/errors';

const PAYMENT_STATUS: PaymentRecordEntity['status'][] = ['pending', 'success', 'failed', 'refunded'];

function coercePaymentStatus(value: unknown): PaymentRecordEntity['status'] | undefined {
  return typeof value === 'string' && PAYMENT_STATUS.includes(value as PaymentRecordEntity['status'])
    ? (value as PaymentRecordEntity['status'])
    : undefined;
}

export function createPaymentRecordController(services: ServiceContainer): Router {
  const router = Router();
  const auth = requireAuth(services);
  const adminOnly = requireRole(services, 'admin');

  const ensurePaymentAccess = async (req: Parameters<ReturnType<typeof asyncHandler>>[0], paymentId: string) => {
    const record = await services.paymentRecordService.findById(paymentId);
    if (req.user?.role === UserRole.ADMIN) {
      return record;
    }
    if (record.user.id !== req.user?.id) {
      throw new AuthorizationError('You may only access your own payment records.');
    }
    return record;
  };

  router.post(
    '/',
    ...adminOnly,
    asyncHandler(async (req, res) => {
      const dto = await validateDto(CreatePaymentRecordDto, req.body);
      const record = await services.paymentRecordService.create(dto);
      return sendSuccess(res, record, 201);
    }),
  );

  router.get(
    '/',
    auth,
    asyncHandler(async (req, res) => {
      const { page, limit } = getPaginationParams(req);
      const filters: { userId?: string; status?: PaymentRecordEntity['status'] } = {};
      if (req.query.userId) filters.userId = String(req.query.userId);
      const status = coercePaymentStatus(req.query.status);
      if (status) filters.status = status;
      if (req.user?.role !== 'admin') {
        filters.userId = req.user?.id;
      }
      const result = await services.paymentRecordService.list({ page, limit, filters });
      return sendSuccess(res, result);
    }),
  );

  router.get(
    '/:id',
    auth,
    asyncHandler(async (req, res) => {
      const record = await ensurePaymentAccess(req, req.params.id);
      return sendSuccess(res, record);
    }),
  );

  router.patch(
    '/:id',
    ...adminOnly,
    asyncHandler(async (req, res) => {
      const dto = await validateDto(UpdatePaymentRecordDto, req.body);
      const record = await services.paymentRecordService.update(req.params.id, dto);
      return sendSuccess(res, record);
    }),
  );

  router.delete(
    '/:id',
    ...adminOnly,
    asyncHandler(async (req, res) => {
      await services.paymentRecordService.delete(req.params.id);
      return sendSuccess(res, { id: req.params.id, deleted: true });
    }),
  );

  router.post(
    '/user/:userId/credit',
    ...adminOnly,
    asyncHandler(async (req, res) => {
      const dto = await validateDto(RecordLedgerDto, req.body);
      const record = await services.paymentRecordService.recordCredit(req.params.userId, dto);
      return sendSuccess(res, record, 201);
    }),
  );

  router.post(
    '/user/:userId/debit',
    ...adminOnly,
    asyncHandler(async (req, res) => {
      const dto = await validateDto(RecordLedgerDto, req.body);
      const record = await services.paymentRecordService.recordDebit(req.params.userId, dto);
      return sendSuccess(res, record, 201);
    }),
  );

  router.get(
    '/user/:userId',
    auth,
    asyncHandler(async (req, res) => {
      assertSelfOrAdmin(req, req.params.userId, 'You may only view your own payment history.');
      const { page, limit } = getPaginationParams(req);
      const status = coercePaymentStatus(req.query.status);
      const filters = status ? { status } : undefined;
      const result = await services.paymentRecordService.listByUser(req.params.userId, { page, limit, filters });
      return sendSuccess(res, result);
    }),
  );

  router.post(
    '/reference/:referenceId/status',
    ...adminOnly,
    asyncHandler(async (req, res) => {
      const dto = await validateDto(UpdatePaymentRecordStatusDto, req.body);
      const record = await services.paymentRecordService.updateStatus(req.params.referenceId, dto.status, dto.processedAt);
      return sendSuccess(res, record);
    }),
  );

  return router;
}
