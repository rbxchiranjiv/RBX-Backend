import { FindOptionsWhere, Repository } from 'typeorm';
import { UserEntity, UserRole } from '../database/entities';
import { ListOptions, PaginatedResult } from './types';
import { NotFoundError, ValidationError } from './errors';

export interface CreateUserInput {
  displayName: string;
  phoneNumber: string;
  email?: string | null;
  role?: UserEntity['role'];
  countryCode?: string | null;
  deviceId?: string | null;
  kycVerified?: boolean;
}

export type UpdateUserInput = Partial<CreateUserInput>;

export class UserService {
  constructor(private readonly userRepo: Repository<UserEntity>) {}

  async create(input: CreateUserInput): Promise<UserEntity> {
    if (!input.displayName || !input.phoneNumber) {
      throw new ValidationError('displayName and phoneNumber are required to create a user.');
    }

    await this.ensureUniqueFields(input.email, input.phoneNumber);

    const user = this.userRepo.create({
      displayName: input.displayName,
      phoneNumber: input.phoneNumber,
      email: input.email ?? null,
      role: input.role ?? UserRole.PLAYER,
      countryCode: input.countryCode ?? null,
      deviceId: input.deviceId ?? null,
      kycVerified: input.kycVerified ?? false,
    });

    return this.userRepo.save(user);
  }

  async findById(id: string): Promise<UserEntity> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundError('User', id);
    }
    return user;
  }

  async update(id: string, input: UpdateUserInput): Promise<UserEntity> {
    const user = await this.findById(id);

    if (input.email || input.phoneNumber) {
      await this.ensureUniqueFields(input.email ?? user.email, input.phoneNumber ?? user.phoneNumber, id);
    }

    this.userRepo.merge(user, input);
    return this.userRepo.save(user);
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
    await this.userRepo.softDelete(id);
  }

  async list(options: ListOptions<FindOptionsWhere<UserEntity>> = {}): Promise<PaginatedResult<UserEntity>> {
    const { page = 1, limit = 25, filters = {} } = options;
    const [data, total] = await this.userRepo.findAndCount({
      where: filters,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { data, total, page, limit };
  }

  private async ensureUniqueFields(email?: string | null, phoneNumber?: string | null, excludeId?: string) {
    if (phoneNumber) {
      const existing = await this.userRepo.findOne({ where: { phoneNumber } });
      if (existing && existing.id !== excludeId) {
        throw new ValidationError('Phone number already in use.');
      }
    }

    if (email) {
      const existing = await this.userRepo.findOne({ where: { email } });
      if (existing && existing.id !== excludeId) {
        throw new ValidationError('Email already in use.');
      }
    }
  }
}
