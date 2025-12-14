import { In, Repository } from 'typeorm';
import { TeamEntity, UserEntity } from '../database/entities';
import { ListOptions, PaginatedResult } from './types';
import { NotFoundError, ValidationError } from './errors';
import type { GlobalConfig } from 'types/globalConfig';

export interface CreateTeamInput {
  name: string;
  slug: string;
  region: string;
  ownerId: string;
  memberIds?: string[];
  verified?: boolean;
}

export type UpdateTeamInput = Partial<CreateTeamInput>;

export class TeamService {
  constructor(
    private readonly teamRepo: Repository<TeamEntity>,
    private readonly userRepo: Repository<UserEntity>,
    private readonly config: GlobalConfig,
  ) {}

  async create(input: CreateTeamInput): Promise<TeamEntity> {
    this.assertRequired(
      Boolean(input.name && input.slug && input.region && input.ownerId),
      'All fields are required to create a team.',
    );

    await this.ensureUnique(input.name, input.slug);

    const owner = await this.ensureUser(input.ownerId);
    const members = await this.resolveMembers(input.memberIds ?? []);

    if (members.length === 0) {
      members.push(owner);
    }

    this.assertMemberLimits(members.length);

    const team = this.teamRepo.create({
      name: input.name,
      slug: input.slug,
      region: input.region,
      verified: input.verified ?? false,
      owner,
      members,
    });

    return this.teamRepo.save(team);
  }

  async findById(id: string): Promise<TeamEntity> {
    const team = await this.teamRepo.findOne({ where: { id }, relations: ['owner', 'members'] });
    if (!team) {
      throw new NotFoundError('Team', id);
    }
    return team;
  }

  async update(id: string, input: UpdateTeamInput): Promise<TeamEntity> {
    const team = await this.findById(id);

    if (input.name || input.slug) {
      await this.ensureUnique(input.name ?? team.name, input.slug ?? team.slug, id);
    }

    if (input.ownerId) {
      team.owner = await this.ensureUser(input.ownerId);
    }

    this.teamRepo.merge(team, {
      name: input.name ?? team.name,
      slug: input.slug ?? team.slug,
      region: input.region ?? team.region,
      verified: input.verified ?? team.verified,
    });

    return this.teamRepo.save(team);
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
    await this.teamRepo.softDelete(id);
  }

  async list(options: ListOptions<{ ownerId?: string; region?: string }> = {}): Promise<PaginatedResult<TeamEntity>> {
    const { page = 1, limit = 25, filters = {} } = options;
    const where: Record<string, unknown> = {};
    if (filters.ownerId) {
      where.owner = { id: filters.ownerId };
    }
    if (filters.region) {
      where.region = filters.region;
    }

    const [data, total] = await this.teamRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { data, total, page, limit };
  }

  async addMember(teamId: string, userId: string): Promise<TeamEntity> {
    const team = await this.findById(teamId);
    const member = await this.ensureUser(userId);

    if (team.members.some(m => m.id === member.id)) {
      throw new ValidationError('User already a member of this team.');
    }

    const totalMembers = team.members.length + 1;
    this.assertMemberLimits(totalMembers);

    team.members.push(member);
    return this.teamRepo.save(team);
  }

  async removeMember(teamId: string, userId: string): Promise<TeamEntity> {
    const team = await this.findById(teamId);
    if (team.owner.id === userId) {
      throw new ValidationError('Owner cannot be removed from their own team.');
    }

    const originalLength = team.members.length;
    team.members = team.members.filter(member => member.id !== userId);

    if (originalLength === team.members.length) {
      throw new ValidationError('Member not part of this team.');
    }

    return this.teamRepo.save(team);
  }

  async listMembers(teamId: string): Promise<UserEntity[]> {
    const team = await this.findById(teamId);
    return team.members;
  }

  async listTeamsForUser(userId: string): Promise<TeamEntity[]> {
    await this.ensureUser(userId);
    return this.teamRepo
      .createQueryBuilder('team')
      .innerJoin('team.members', 'member', 'member.id = :userId', { userId })
      .leftJoinAndSelect('team.owner', 'owner')
      .leftJoinAndSelect('team.members', 'members')
      .getMany();
  }

  private async ensureUnique(name: string, slug: string, excludeId?: string) {
    const existingByName = await this.teamRepo.findOne({ where: { name } });
    if (existingByName && existingByName.id !== excludeId) {
      throw new ValidationError('Team name already in use.');
    }

    const existingBySlug = await this.teamRepo.findOne({ where: { slug } });
    if (existingBySlug && existingBySlug.id !== excludeId) {
      throw new ValidationError('Team slug already in use.');
    }
  }

  private assertRequired(condition: boolean, message: string) {
    if (!condition) {
      throw new ValidationError(message);
    }
  }

  private assertMemberLimits(count: number) {
    const { minPlayersPerTeam, maxPlayersPerTeam } = this.config.limits;
    if (count < minPlayersPerTeam) {
      throw new ValidationError(`Teams must have at least ${minPlayersPerTeam} members.`);
    }
    if (count > maxPlayersPerTeam) {
      throw new ValidationError(`Teams cannot exceed ${maxPlayersPerTeam} members.`);
    }
  }

  private async ensureUser(id: string): Promise<UserEntity> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundError('User', id);
    }
    return user;
  }

  private async resolveMembers(memberIds: string[]): Promise<UserEntity[]> {
    if (!memberIds.length) {
      return [];
    }

    const members = await this.userRepo.find({ where: { id: In(memberIds) } });
    if (members.length !== memberIds.length) {
      throw new ValidationError('One or more member IDs are invalid.');
    }
    return members;
  }
}
