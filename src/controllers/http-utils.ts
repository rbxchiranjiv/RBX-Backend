import { NextFunction, Request, RequestHandler, Response } from 'express';
import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  DomainError,
  NotFoundError,
  ValidationError,
} from '../services/errors';

export type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export const asyncHandler = (handler: AsyncHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

export function sendSuccess(res: Response, data: unknown, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function mapDomainError(error: unknown) {
  if (error instanceof NotFoundError) {
    return { status: 404, body: { success: false, error: { message: error.message } } };
  }
  if (error instanceof ValidationError) {
    return { status: 400, body: { success: false, error: { message: error.message, details: error.details } } };
  }
  if (error instanceof ConflictError) {
    return { status: 409, body: { success: false, error: { message: error.message, details: error.details } } };
  }
  if (error instanceof AuthenticationError) {
    return { status: 401, body: { success: false, error: { message: error.message } } };
  }
  if (error instanceof AuthorizationError) {
    return { status: 403, body: { success: false, error: { message: error.message } } };
  }
  if (error instanceof DomainError) {
    return { status: 400, body: { success: false, error: { message: error.message, details: error.details } } };
  }
  return { status: 500, body: { success: false, error: { message: 'Internal server error' } } };
}

export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
}

export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
  };
}

export function buildSuccessResponse<T>(data: T): SuccessResponse<T> {
  return { success: true, data };
}

export function buildMessageResponse(message: string): SuccessResponse<{ message: string }> {
  return buildSuccessResponse({ message });
}
