import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';

import { CreateUserDto } from './dto/create-user.dto';
import { UserEntity, UserRole, UserStatus } from '../../database/entities/user.entity';

const DEFAULT_PASSWORD_HASH_ROUNDS = 12;

export type SafeUser = Omit<UserEntity, 'passwordHash' | 'passwordResetToken' | 'passwordResetExpiresAt'>;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
  ) {}

  async createUser(payload: CreateUserDto): Promise<SafeUser> {
    await this.ensureUniqueEmail(payload.email);

    if (payload.phoneNumber) {
      await this.ensureUniquePhone(payload.phoneNumber);
    }

    const passwordHash = await bcrypt.hash(payload.password, DEFAULT_PASSWORD_HASH_ROUNDS);

    const user = this.usersRepo.create({
      displayName: payload.displayName ?? payload.email.split('@')[0],
      email: payload.email.toLowerCase(),
      phoneNumber: payload.phoneNumber ?? null,
      passwordHash,
      role: payload.role ?? UserRole.USER,
      countryCode: payload.countryCode,
      deviceId: payload.deviceId,
      timezone: payload.timezone,
      marketingOptIn: payload.marketingOptIn ?? false,
      avatarUrl: payload.avatarUrl,
      preferences: payload.preferences ?? {},
      metadata: payload.metadata ?? {},
      status: UserStatus.ACTIVE,
    });

    const savedUser = await this.usersRepo.save(user);
    return this.sanitizeUser(savedUser);
  }

  async findForAuth(email: string): Promise<UserEntity | null> {
    return this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('LOWER(user.email) = LOWER(:email)', { email })
      .getOne();
  }

  async getProfile(id: string): Promise<SafeUser> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.sanitizeUser(user);
  }

  private async ensureUniqueEmail(email: string): Promise<void> {
    const existing = await this.usersRepo.findOne({ where: { email: email.toLowerCase() } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
  }

  private async ensureUniquePhone(phoneNumber: string): Promise<void> {
    const existing = await this.usersRepo.findOne({ where: { phoneNumber } });
    if (existing) {
      throw new ConflictException('Phone number already registered');
    }
  }

  public sanitizeUser(user: UserEntity): SafeUser {
    const { passwordHash, passwordResetToken, passwordResetExpiresAt, ...safe } = user;
    return safe as SafeUser;
  }
}
