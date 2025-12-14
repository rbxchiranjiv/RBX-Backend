import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { UserEntity, RefreshTokenEntity } from '../database/entities';
import {
  getAccessTokenExpirySeconds,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken as verifyAccessTokenJwt,
  verifyRefreshToken as verifyRefreshTokenJwt,
} from '../auth/jwt';
import { NotFoundError, ValidationError } from './errors';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class AuthService {
  constructor(
    private readonly userRepo: Repository<UserEntity>,
    private readonly refreshRepo: Repository<RefreshTokenEntity>,
  ) {}

  async login(phoneNumber: string): Promise<{ user: UserEntity } & AuthTokens> {
    let user = await this.userRepo.findOne({ where: { phoneNumber } });
    if (!user) {
      user = await this.userRepo.save(
        this.userRepo.create({ displayName: phoneNumber, phoneNumber, role: 'player' }),
      );
    }

    const tokens = await this.issueTokens(user);
    return { ...tokens, user };
  }

  async refresh(refreshToken: string): Promise<{ user: UserEntity } & AuthTokens> {
    const payload = verifyRefreshTokenJwt(refreshToken);
    const tokenRecord = await this.refreshRepo.findOne({ where: { tokenId: payload.jti }, relations: ['user'] });
    if (!tokenRecord) {
      throw new ValidationError('Invalid refresh token.');
    }

    if (tokenRecord.revoked) {
      throw new ValidationError('Refresh token has been revoked.');
    }

    if (tokenRecord.expiresAt.getTime() < Date.now()) {
      await this.refreshRepo.update(tokenRecord.id, { revoked: true });
      throw new ValidationError('Refresh token has expired.');
    }

    const providedHash = hashToken(refreshToken);
    if (tokenRecord.tokenHash !== providedHash) {
      await this.refreshRepo.update(tokenRecord.id, { revoked: true });
      throw new ValidationError('Refresh token mismatch.');
    }

    tokenRecord.revoked = true;
    await this.refreshRepo.save(tokenRecord);

    const user = tokenRecord.user ?? (await this.userRepo.findOne({ where: { id: payload.sub } }));
    if (!user) {
      throw new NotFoundError('User', payload.sub);
    }

    const tokens = await this.issueTokens(user);
    return { ...tokens, user };
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const payload = verifyRefreshTokenJwt(refreshToken);
    await this.refreshRepo.update({ tokenId: payload.jti }, { revoked: true });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.refreshRepo.update({ user: { id: userId } }, { revoked: true });
  }

  verifyAccessToken(token: string) {
    return verifyAccessTokenJwt(token);
  }

  verifyRefreshToken(token: string) {
    return verifyRefreshTokenJwt(token);
  }

  private async issueTokens(user: UserEntity): Promise<AuthTokens> {
    const payload = { sub: user.id, role: user.role } as const;
    const accessToken = signAccessToken(payload);
    const refresh = signRefreshToken({ ...payload, jti: randomUUID() });

    const refreshEntity = this.refreshRepo.create({
      tokenId: refresh.tokenId,
      tokenHash: hashToken(refresh.token),
      expiresAt: refresh.expiresAt,
      revoked: false,
      user,
    });
    await this.refreshRepo.save(refreshEntity);

    return { accessToken, refreshToken: refresh.token, expiresIn: getAccessTokenExpirySeconds() };
  }
}
