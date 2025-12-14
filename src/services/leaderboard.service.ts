import { Repository, DataSource } from 'typeorm';
import { Injectable } from '@nestjs/common';
import {
  LeaderboardSnapshotEntity,
  LeaderboardType,
  LeaderboardCategory,
  StandingEntity,
  StandingType,
  StandingStatus,
  TournamentEntity,
  TeamEntity,
  UserEntity,
} from '../database/entities';
import { cacheWrap, cacheInvalidate } from './cache.service';

export interface LeaderboardQueryOptions {
  type: LeaderboardType;
  category: LeaderboardCategory;
  seasonId?: string;
  tournamentId?: string;
  region?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  rank: number;
  points: number;
  stats: Record<string, any>;
  change?: number; // Rank change from previous snapshot
  teamId?: string;
  userId?: string;
}

export interface LeaderboardResult {
  entries: LeaderboardEntry[];
  totalEntries: number;
  lastUpdated: Date;
  snapshotKey: string;
  hasNext: boolean;
  hasPrevious: boolean;
}

@Injectable()
export class LeaderboardService {
  constructor(
    private readonly leaderboardSnapshotRepo: Repository<LeaderboardSnapshotEntity>,
    private readonly standingRepo: Repository<StandingEntity>,
    private readonly tournamentRepo: Repository<TournamentEntity>,
    private readonly teamRepo: Repository<TeamEntity>,
    private readonly userRepo: Repository<UserEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async getLeaderboard(options: LeaderboardQueryOptions): Promise<LeaderboardResult> {
    const cacheKey = this.generateCacheKey(options);
    
    // Use cache wrapper
    return cacheWrap(cacheKey, 10, async () => {
      // Try to get existing snapshot
      const snapshot = await this.getLatestSnapshot(options);
      
      if (snapshot && this.isSnapshotValid(snapshot, options)) {
        const result = this.formatSnapshotResult(snapshot, options);
        return result;
      }

      // Generate new leaderboard
      const result = await this.generateLeaderboard(options);
      
      // Create snapshot for future use
      await this.createSnapshot(result, options);
      
      return result;
    });
  }

  async refreshLeaderboard(options: LeaderboardQueryOptions): Promise<LeaderboardResult> {
    // Invalidate cache
    const cacheKey = this.generateCacheKey(options);
    cacheInvalidate(cacheKey);

    // Generate fresh leaderboard
    const result = await this.generateLeaderboard(options);
    
    // Create new snapshot
    await this.createSnapshot(result, options);
    
    return result;
  }

  private async generateLeaderboard(options: LeaderboardQueryOptions): Promise<LeaderboardResult> {
    let entries: LeaderboardEntry[] = [];
    let totalEntries = 0;

    switch (options.type) {
      case LeaderboardType.TOURNAMENT:
        if (!options.tournamentId) {
          throw new Error('Tournament ID is required for tournament leaderboards');
        }
        ({ entries, totalEntries } = await this.generateTournamentLeaderboard(options));
        break;

      case LeaderboardType.SEASON:
        ({ entries, totalEntries } = await this.generateSeasonLeaderboard(options));
        break;

      case LeaderboardType.GLOBAL:
        ({ entries, totalEntries } = await this.generateGlobalLeaderboard(options));
        break;

      default:
        throw new Error(`Unsupported leaderboard type: ${options.type}`);
    }

    // Apply sorting
    entries = this.sortEntries(entries, options.sortBy || 'points', options.sortOrder || 'desc');

    // Apply pagination
    const startIndex = options.offset || 0;
    const endIndex = startIndex + (options.limit || 100);
    const paginatedEntries = entries.slice(startIndex, endIndex);

    return {
      entries: paginatedEntries,
      totalEntries: entries.length,
      lastUpdated: new Date(),
      snapshotKey: this.generateSnapshotKey(options),
      hasNext: endIndex < entries.length,
      hasPrevious: startIndex > 0,
    };
  }

  private async generateTournamentLeaderboard(
    options: LeaderboardQueryOptions,
  ): Promise<{ entries: LeaderboardEntry[]; totalEntries: number }> {
    const standings = await this.standingRepo.find({
      where: {
        tournamentId: options.tournamentId,
        type: StandingType.TOURNAMENT,
        status: StandingStatus.FINAL,
        ...(options.region && { region: options.region }),
      },
      relations: ['team', 'user'],
      order: { rank: 'ASC' },
    });

    const entries: LeaderboardEntry[] = [];

    for (const standing of standings || []) {
      const entry: LeaderboardEntry = {
        id: standing.teamId || standing.userId,
        name: standing.team?.name || standing.user?.displayName || 'Unknown',
        rank: standing.rank,
        points: standing.points,
        stats: {
          matchesPlayed: standing.matchesPlayed,
          wins: standing.wins,
          losses: standing.losses,
          draws: standing.draws,
          kills: standing.kills,
          deaths: standing.deaths,
          assists: standing.assists,
          kdratio: standing.kdratio,
          avgPlacement: standing.avgPlacement,
        },
        teamId: standing.teamId,
        userId: standing.userId,
      };

      // Add mode-specific stats
      if (standing.survivalTime > 0) {
        entry.stats.survivalTime = standing.survivalTime;
      }
      if (standing.adr > 0) {
        entry.stats.adr = standing.adr;
      }
      if (standing.hsPercentage > 0) {
        entry.stats.hsPercentage = standing.hsPercentage;
      }

      entries.push(entry);
    }

    return { entries, totalEntries: entries.length };
  }

  private async generateSeasonLeaderboard(
    options: LeaderboardQueryOptions,
  ): Promise<{ entries: LeaderboardEntry[]; totalEntries: number }> {
    const seasonId = options.seasonId || this.getCurrentSeason();
    
    let queryBuilder = this.standingRepo
      .createQueryBuilder('standing')
      .leftJoinAndSelect('standing.team', 'team')
      .leftJoinAndSelect('standing.user', 'user')
      .where('standing.seasonId = :seasonId', { seasonId })
      .andWhere('standing.type = :type', { type: StandingType.SEASON })
      .andWhere('standing.status = :status', { status: StandingStatus.FINAL }); // <--- Fixed StandingStatus enum reference

    if (options.region) {
      queryBuilder.andWhere('standing.region = :region', { region: options.region });
    }

    // Filter by category
    if (options.category === LeaderboardCategory.TEAMS) {
      queryBuilder.andWhere('standing.teamId IS NOT NULL');
    } else if (options.category === LeaderboardCategory.PLAYERS) {
      queryBuilder.andWhere('standing.userId IS NOT NULL');
    }

    // Get the latest standing for each participant
    const standings = await queryBuilder
      .orderBy('standing.rank', 'ASC')
      .limit(options.limit || 1000)
      .getMany();

    const entries: LeaderboardEntry[] = [];

    for (const standing of standings) {
      const entry: LeaderboardEntry = {
        id: standing.teamId || standing.userId,
        name: standing.team?.name || standing.user?.displayName || 'Unknown',
        rank: standing.rank,
        points: standing.points,
        stats: {
          tournamentsPlayed: standing.matchesPlayed,
          wins: standing.wins,
          losses: standing.losses,
          draws: standing.draws,
          kills: standing.kills,
          deaths: standing.deaths,
          assists: standing.assists,
          kdratio: standing.kdratio,
          avgPlacement: standing.avgPlacement,
        },
        teamId: standing.teamId,
        userId: standing.userId,
      };

      entries.push(entry);
    }

    return { entries, totalEntries: entries.length };
  }

  private async generateGlobalLeaderboard(
    options: LeaderboardQueryOptions,
  ): Promise<{ entries: LeaderboardEntry[]; totalEntries: number }> {
    // Similar to season leaderboard but across all seasons
    let queryBuilder = this.standingRepo
      .createQueryBuilder('standing')
      .leftJoinAndSelect('standing.team', 'team')
      .leftJoinAndSelect('standing.user', 'user')
      .where('standing.type = :type', { type: StandingType.GLOBAL })
      .andWhere('standing.status = :status', { status: 'final' });

    if (options.region) {
      queryBuilder.andWhere('standing.region = :region', { region: options.region });
    }

    // Filter by category
    if (options.category === LeaderboardCategory.TEAMS) {
      queryBuilder.andWhere('standing.teamId IS NOT NULL');
    } else if (options.category === LeaderboardCategory.PLAYERS) {
      queryBuilder.andWhere('standing.userId IS NOT NULL');
    }

    const standings = await queryBuilder
      .orderBy('standing.rank', 'ASC')
      .limit(options.limit || 1000)
      .getMany();

    const entries: LeaderboardEntry[] = [];

    for (const standing of standings) {
      const entry: LeaderboardEntry = {
        id: standing.teamId || standing.userId,
        name: standing.team?.name || standing.user?.displayName || 'Unknown',
        rank: standing.rank,
        points: standing.points,
        stats: {
          tournamentsPlayed: standing.matchesPlayed,
          wins: standing.wins,
          losses: standing.losses,
          draws: standing.draws,
          kills: standing.kills,
          deaths: standing.deaths,
          assists: standing.assists,
          kdratio: standing.kdratio,
          avgPlacement: standing.avgPlacement,
        },
        teamId: standing.teamId,
        userId: standing.userId,
      };

      entries.push(entry);
    }

    return { entries, totalEntries: entries.length };
  }

  private sortEntries(
    entries: LeaderboardEntry[],
    sortBy: string,
    sortOrder: 'asc' | 'desc',
  ): LeaderboardEntry[] {
    return entries.sort((a, b) => {
      let aValue: number;
      let bValue: number;

      switch (sortBy) {
        case 'points':
          aValue = a.points;
          bValue = b.points;
          break;
        case 'rank':
          aValue = a.rank;
          bValue = b.rank;
          break;
        case 'wins':
          aValue = a.stats.wins || 0;
          bValue = b.stats.wins || 0;
          break;
        case 'kills':
          aValue = a.stats.kills || 0;
          bValue = b.stats.kills || 0;
          break;
        case 'kdratio':
          aValue = a.stats.kdratio || 0;
          bValue = b.stats.kdratio || 0;
          break;
        case 'avgPlacement':
          aValue = a.stats.avgPlacement || 0;
          bValue = b.stats.avgPlacement || 0;
          break;
        default:
          aValue = a.points;
          bValue = b.points;
      }

      if (sortOrder === 'desc') {
        return bValue - aValue;
      } else {
        return aValue - bValue;
      }
    });
  }

  private async getLatestSnapshot(options: LeaderboardQueryOptions): Promise<LeaderboardSnapshotEntity | null> {
    return this.leaderboardSnapshotRepo.findOne({
      where: {
        type: options.type,
        category: options.category,
        seasonId: options.seasonId || this.getCurrentSeason(),
        ...(options.tournamentId && { tournamentId: options.tournamentId }),
        region: options.region || 'global',
      },
      order: { createdAt: 'DESC' },
    });
  }

  private isSnapshotValid(
    snapshot: LeaderboardSnapshotEntity,
    options: LeaderboardQueryOptions,
  ): boolean {
    // Check if snapshot is recent (within 5 minutes)
    const now = new Date();
    const snapshotAge = now.getTime() - snapshot.createdAt.getTime();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    if (snapshotAge > maxAge) {
      return false;
    }

    // Check if filters match
    if (JSON.stringify(snapshot.filters) !== JSON.stringify(options.filters || {})) {
      return false;
    }

    // Check if sorting matches
    if (snapshot.sortBy !== (options.sortBy || 'points')) {
      return false;
    }

    if (snapshot.sortOrder !== (options.sortOrder || 'desc')) {
      return false;
    }

    return true;
  }

  private formatSnapshotResult(
    snapshot: LeaderboardSnapshotEntity,
    options: LeaderboardQueryOptions,
  ): LeaderboardResult {
    const startIndex = options.offset || 0;
    const endIndex = startIndex + (options.limit || 100);
    const entries = snapshot.data.entries.slice(startIndex, endIndex);

    return {
      entries,
      totalEntries: snapshot.data.totalEntries,
      lastUpdated: snapshot.createdAt,
      snapshotKey: snapshot.snapshotKey,
      hasNext: endIndex < snapshot.data.totalEntries,
      hasPrevious: startIndex > 0,
    };
  }

  private async createSnapshot(
    result: LeaderboardResult,
    options: LeaderboardQueryOptions,
  ): Promise<void> {
    const snapshot = this.leaderboardSnapshotRepo.create({
      ...(options.tournamentId && { tournamentId: options.tournamentId }),
      seasonId: options.seasonId || this.getCurrentSeason(),
      type: options.type,
      category: options.category,
      region: options.region || 'global',
      data: {
        entries: result.entries,
        totalEntries: result.totalEntries,
        lastUpdated: result.lastUpdated.toISOString(),
      },
      snapshotKey: result.snapshotKey,
      maxEntries: options.limit || 100,
      filters: options.filters || {},
      sortBy: options.sortBy || 'points',
      sortOrder: options.sortOrder || 'desc',
    });

    await this.leaderboardSnapshotRepo.save(snapshot);
  }

  private generateCacheKey(options: LeaderboardQueryOptions): string {
    return `leaderboard:${JSON.stringify(options)}`;
  }

  private generateSnapshotKey(options: LeaderboardQueryOptions): string {
    const parts = [
      options.type,
      options.category,
      options.seasonId || this.getCurrentSeason(),
      options.tournamentId || 'global',
      options.region || 'global',
      options.sortBy || 'points',
      options.sortOrder || 'desc',
    ];
    return parts.join(':');
  }

  private getCurrentSeason(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const quarter = Math.floor(month / 3) + 1;
    return `${year}-Q${quarter}`;
  }

  async invalidateCache(pattern?: string): Promise<void> {
    if (pattern) {
      // Invalidate cache entries matching pattern
      cacheInvalidate(pattern);
    } else {
      // Clear all cache
      const { cache } = await import('./cache.service');
      cache.clear();
    }
  }

  async getLeaderboardHistory(
    options: LeaderboardQueryOptions,
    limit: number = 10,
  ): Promise<LeaderboardSnapshotEntity[]> {
    return this.leaderboardSnapshotRepo.find({
      where: {
        type: options.type,
        category: options.category,
        seasonId: options.seasonId || this.getCurrentSeason(),
        ...(options.tournamentId && { tournamentId: options.tournamentId }),
        region: options.region || 'global',
      },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
