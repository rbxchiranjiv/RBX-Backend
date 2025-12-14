import { Inject, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';

import { GLOBAL_CONFIG } from '../../common/providers/global-config.provider';
import type { GlobalConfig } from 'types/globalConfig';
import { CreateUserDto } from './dto/create-user.dto';
import { UserEntity, UserRole, UserStatus } from '../../database/entities/user.entity';

const DEFAULT_PASSWORD_HASH_ROUNDS = 12;

export interface UsersServicePort {
  create(payload: CreateUserDto): Promise<UserEntity>;
  findOne(id: string): Promise<UserEntity>;
}

@Injectable()
export class UsersService implements UsersServicePort {
  constructor(
    @Inject(GLOBAL_CONFIG) private readonly config: GlobalConfig,
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
  ) {}

  async create(payload: CreateUserDto): Promise<UserEntity> {
    const [existingEmail, existingPhone] = await Promise.all([
      this.usersRepo.findOne({ where: { email: payload.email } }),
      this.usersRepo.findOne({ where: { phoneNumber: payload.phoneNumber } }),
    ]);

    if (existingEmail) {
      throw new ConflictException('Email already registered');
    }

    if (existingPhone) {
      throw new ConflictException('Phone number already registered');
    }

    const passwordHash = await bcrypt.hash(payload.password, DEFAULT_PASSWORD_HASH_ROUNDS);

    const user = this.usersRepo.create({
      displayName: payload.displayName,
      email: payload.email,
      phoneNumber: payload.phoneNumber,
      passwordHash,
      role: payload.role ?? UserRole.PLAYER,
      countryCode: payload.countryCode,
      deviceId: payload.deviceId,
      timezone: payload.timezone,
      marketingOptIn: payload.marketingOptIn ?? false,
      preferences: payload.preferences ?? {},
      metadata: payload.metadata ?? {},
      status: UserStatus.ACTIVE,
    });

    return await this.usersRepo.save(user);
  }

  async findOne(id: string): Promise<UserEntity> {
    const user = await this.usersRepo.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}
