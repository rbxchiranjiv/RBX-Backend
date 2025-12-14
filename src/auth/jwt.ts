import jwt, { JwtPayload } from 'jsonwebtoken';
import { createHmac, randomUUID } from 'crypto';
import type { UserRole } from '../database/entities/user.entity';

const JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
const ACCESS_TOKEN_EXP = process.env.ACCESS_TOKEN_EXP ?? '15m';
const REFRESH_TOKEN_EXP = process.env.REFRESH_TOKEN_EXP ?? '7d';

type DurationUnit = 's' | 'm' | 'h' | 'd';

function parseDuration(value: string): number {
  const match = /^([0-9]+)([smhd])$/.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid duration format: ${value}`);
  }
  const amount = Number(match[1]);
  const unit = match[2] as DurationUnit;
  const multipliers: Record<DurationUnit, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return amount * multipliers[unit];
}

const ACCESS_TOKEN_EXP_MS = parseDuration(ACCESS_TOKEN_EXP);
const REFRESH_TOKEN_EXP_MS = parseDuration(REFRESH_TOKEN_EXP);

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  role: UserRole;
}

export interface RefreshTokenPayload extends AccessTokenPayload {
  jti: string;
}

export interface SignedRefreshToken {
  token: string;
  tokenId: string;
  expiresAt: Date;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXP });
}

export function signRefreshToken(payload: RefreshTokenPayload): SignedRefreshToken {
  const tokenId = payload.jti ?? randomUUID();
  const token = jwt.sign({ ...payload, jti: tokenId }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXP });
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXP_MS);
  return { token, tokenId, expiresAt };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, JWT_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, JWT_SECRET) as RefreshTokenPayload;
}

export function hashToken(token: string): string {
  return createHmac('sha256', JWT_SECRET).update(token).digest('hex');
}

export function getAccessTokenExpirySeconds(): number {
  return Math.floor(ACCESS_TOKEN_EXP_MS / 1000);
}

export function getRefreshTokenExpiryMs(): number {
  return REFRESH_TOKEN_EXP_MS;
}
