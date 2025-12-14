import { Request } from 'express';

export function getPaginationParams(req: Request) {
  const page = clampToInt(req.query.page, 1);
  const limit = clampToInt(req.query.limit, 25);
  return { page, limit };
}

function clampToInt(value: unknown, fallback: number) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return fallback;
  }
  return Math.floor(num);
}
