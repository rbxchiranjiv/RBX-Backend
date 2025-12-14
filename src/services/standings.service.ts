import { Repository, DataSource } from 'typeorm';
import { Injectable } from '@nestjs/common';
import {
  StandingEntity,
  StandingType,
  StandingStatus,
  TournamentEntity,
  TeamEntity,
  UserEntity,
  MatchEntity,
  RegistrationEntity,
} from '../database/entities';

export interface StandingCalculationOptions {
  tournamentId?: string;
  seasonId?: string;
  type?: StandingType;
  region?: string;
  includeMetadata?: boolean;
}

export interface TournamentStandingsQueryOptions {
  tournamentId: string;
  limit?: number;
  offset?: number;
  region?: string;
}

export interface BRStandingStats {
  kills: number;
  deaths: number;
  assists: number;
  survivalTime: number;
  placement: number;
  damageDealt: number;
  damageTaken: number;
}

export interface CSStandingStats {
  kills: number;
  deaths: number;
  assists: number;
  adr: number;
  hsPercentage: number;
  roundsWon: number;
  roundsLost: number;
  utilityDamage: number;
  clutchWins: number;
}

export interface StandingPointSystem {
  placementPoints: { [placement: number]: number };
  killPoints: number;
  assistPoints: number;
  survivalPoints: number;
  damagePoints: number;
  winBonus: number;
  eliminationBonus: number;
}

@Injectable()
export class StandingsService {
  constructor(
    private readonly standingRepo: Repository<StandingEntity>,
    private readonly tournamentRepo: Repository<TournamentEntity>,
    private readonly teamRepo: Repository<TeamEntity>,
    private readonly userRepo: Repository<UserEntity>,
    private readonly matchRepo: Repository<MatchEntity>,
    private readonly registrationRepo: Repository<RegistrationEntity>,
    private readonly dataSource: DataSource,
  ) {}

  // Default point systems for different modes
  private readonly BR_POINT_SYSTEM: StandingPointSystem = {
    placementPoints: {
      1: 100, 2: 80, 3: 65, 4: 55, 5: 45, 6: 40, 7: 35, 8: 30,
      9: 25, 10: 20, 11: 18, 12: 16, 13: 14, 14: 12, 15: 10,
      16: 8, 17: 6, 18: 4, 19: 2, 20: 1,
    },
    killPoints: 2,
    assistPoints: 1,
    survivalPoints: 1,
    damagePoints: 0.01, // 1 point per 100 damage
    winBonus: 25,
    eliminationBonus: 5,
  };

  private readonly CS_POINT_SYSTEM: StandingPointSystem = {
    placementPoints: {
      1: 50, 2: 40, 3: 35, 4: 30, 5: 25, 6: 20, 7: 15, 8: 10,
      9: 8, 10: 6, 11: 4, 12: 2, 13: 1,
    },
    killPoints: 3,
    assistPoints: 1,
    survivalPoints: 0,
    damagePoints: 0.02, // 1 point per 50 damage (ADR)
    winBonus: 15,
    eliminationBonus: 2,
  };

  async calculateTournamentStandings(
    tournamentId: string,
    options: StandingCalculationOptions = {},
  ): Promise<StandingEntity[]> {
    const tournament = await this.tournamentRepo.findOne({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new Error(`Tournament ${tournamentId} not found`);
    }

    const seasonId = options.seasonId || this.getCurrentSeason();
    const region = options.region || 'global';

    // Set standings to calculating status
    await this.standingRepo.update(
      {
        tournamentId,
        type: StandingType.TOURNAMENT,
      },
      { status: StandingStatus.CALCULATING },
    );

    try {
      let standings: StandingEntity[];

      if (tournament.mode === 'BR') {
        standings = await this.calculateBRStandings(tournament, seasonId, region);
      } else if (tournament.mode === 'CS') {
        standings = await this.calculateCSStandings(tournament, seasonId, region);
      } else {
        throw new Error(`Unsupported tournament mode: ${tournament.mode}`);
      }

      // Update ranks and finalize standings
      standings = await this.assignRanksAndFinalize(standings);

      return standings;
    } catch (error) {
      // Reset status on error
      await this.standingRepo.update(
        {
          tournamentId,
          type: StandingType.TOURNAMENT,
        },
        { status: StandingStatus.ACTIVE },
      );
      throw error;
    }
  }

  private async calculateBRStandings(
    tournament: TournamentEntity,
    seasonId: string,
    region: string,
  ): Promise<StandingEntity[]> {
    const pointSystem = this.BR_POINT_SYSTEM;

    // Get all completed matches for the tournament
    const matches = await this.matchRepo.find({
      where: {
        tournament: { id: tournament.id },
        status: 'ended' as any,
      },
      relations: ['participants'],
    });

    // Get all registered teams/players
    const registrations = await this.registrationRepo.find({
      where: { tournament: { id: tournament.id } },
      relations: ['team', 'player'],
    });

    // Initialize standings for all participants
    const standingsMap = new Map<string, StandingEntity>();

    for (const registration of registrations) {
      const standing = this.standingRepo.create({
        tournamentId: tournament.id,
        teamId: registration.teamId,
        userId: registration.playerId,
        seasonId,
        type: StandingType.TOURNAMENT,
        status: StandingStatus.ACTIVE,
        region,
        points: 0,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        survivalTime: 0,
        avgPlacement: 0,
        metadata: {},
      });

      standingsMap.set(
        registration.teamId || registration.playerId || 'unknown',
        standing,
      );
    }

    // Process each match result
    for (const match of matches) {
      if (!match.results) continue;
      
      for (const result of match.results) {
        const participantId = result.teamId || result.playerId;
        if (!participantId) continue;
        
        const standing = standingsMap.get(participantId);

        if (!standing) continue;

        const stats = result.stats as BRStandingStats;
        const placement = result.placement;

        // Calculate points
        let matchPoints = 0;

        // Placement points
        matchPoints += pointSystem.placementPoints[placement] || 0;

        // Kill points
        matchPoints += (stats.kills || 0) * pointSystem.killPoints;

        // Assist points
        matchPoints += (stats.assists || 0) * pointSystem.assistPoints;

        // Survival points (based on survival time)
        matchPoints += Math.floor((stats.survivalTime || 0) / 60) * pointSystem.survivalPoints;

        // Damage points
        matchPoints += Math.floor((stats.damageDealt || 0) / 100) * pointSystem.damagePoints;

        // Win bonus
        if (placement === 1) {
          matchPoints += pointSystem.winBonus;
          standing.wins++;
        }

        // Elimination bonus (if not eliminated)
        if (placement <= 20) {
          matchPoints += pointSystem.eliminationBonus;
        } else {
          standing.losses++;
        }

        standing.matchesPlayed++;
        standing.points += matchPoints;
        standing.kills += stats.kills || 0;
        standing.deaths += stats.deaths || 0;
        standing.assists += stats.assists || 0;
        standing.survivalTime += stats.survivalTime || 0;

        // Update average placement
        standing.avgPlacement =
          (standing.avgPlacement * (standing.matchesPlayed - 1) + placement) / standing.matchesPlayed;

        // Update metadata with match-specific data
        standing.metadata[`match_${match.id}`] = {
          placement,
          points: matchPoints,
          stats,
        };
      }
    }

    // Calculate K/D ratio for each standing
    for (const standing of standingsMap.values()) {
      if (standing.deaths > 0) {
        standing.kdratio = Number((standing.kills / standing.deaths).toFixed(2));
      } else if (standing.kills > 0) {
        standing.kdratio = standing.kills; // Perfect ratio
      }
    }

    return Array.from(standingsMap.values());
  }

  private async calculateCSStandings(
    tournament: TournamentEntity,
    seasonId: string,
    region: string,
  ): Promise<StandingEntity[]> {
    const pointSystem = this.CS_POINT_SYSTEM;

    // Get all completed matches for the tournament
    const matches = await this.matchRepo.find({
      where: {
        tournament: { id: tournament.id },
        status: 'ended' as any,
      },
      relations: ['participants'],
    });

    // Get all registered teams/players
    const registrations = await this.registrationRepo.find({
      where: { tournament: { id: tournament.id } },
      relations: ['team', 'player'],
    });

    // Initialize standings for all participants
    const standingsMap = new Map<string, StandingEntity>();

    for (const registration of registrations) {
      const standing = this.standingRepo.create({
        tournamentId: tournament.id,
        teamId: registration.teamId,
        userId: registration.playerId,
        seasonId,
        type: StandingType.TOURNAMENT,
        status: StandingStatus.ACTIVE,
        region,
        points: 0,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        roundsWon: 0,
        roundsLost: 0,
        kdratio: 0,
        adr: 0,
        hsPercentage: 0,
        metadata: {},
      });

      standingsMap.set(
        registration.teamId || registration.playerId || 'unknown',
        standing,
      );
    }

    // Process each match result
    for (const match of matches) {
      if (!match.results) continue;
      
      for (const result of match.results) {
        const participantId = result.teamId || result.playerId;
        if (!participantId) continue;
        
        const standing = standingsMap.get(participantId);

        if (!standing) continue;

        const stats = result.stats as CSStandingStats;
        const placement = result.placement;

        // Calculate points
        let matchPoints = 0;

        // Placement points
        matchPoints += pointSystem.placementPoints[placement] || 0;

        // Kill points
        matchPoints += (stats.kills || 0) * pointSystem.killPoints;

        // Assist points
        matchPoints += (stats.assists || 0) * pointSystem.assistPoints;

        // Damage points (ADR-based)
        matchPoints += Math.floor((stats.adr || 0) / 50) * pointSystem.damagePoints;

        // Win bonus
        if (placement === 1) {
          matchPoints += pointSystem.winBonus;
          standing.wins++;
        } else if (placement === 2) {
          standing.losses++;
        } else {
          standing.draws++; // For CS, draws could be ties or specific placements
        }

        standing.matchesPlayed++;
        standing.points += matchPoints;
        standing.kills += stats.kills || 0;
        standing.deaths += stats.deaths || 0;
        standing.assists += stats.assists || 0;
        standing.roundsWon += stats.roundsWon || 0;
        standing.roundsLost += stats.roundsLost || 0;

        // Update ADR (cumulative average)
        standing.adr = (standing.adr * (standing.matchesPlayed - 1) + (stats.adr || 0)) / standing.matchesPlayed;

        // Update headshot percentage (cumulative average)
        standing.hsPercentage =
          (standing.hsPercentage * (standing.matchesPlayed - 1) + (stats.hsPercentage || 0)) / standing.matchesPlayed;

        // Update K/D ratio
        if (standing.deaths > 0) {
          standing.kdratio = Number((standing.kills / standing.deaths).toFixed(2));
        } else if (standing.kills > 0) {
          standing.kdratio = standing.kills;
        }

        // Update metadata with match-specific data
        standing.metadata[`match_${match.id}`] = {
          placement,
          points: matchPoints,
          stats,
        };
      }
    }

    return Array.from(standingsMap.values());
  }

  private async assignRanksAndFinalize(standings: StandingEntity[]): Promise<StandingEntity[]> {
    // Sort by points (descending), then by other tie-breakers
    standings.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (a.avgPlacement !== b.avgPlacement) return a.avgPlacement - b.avgPlacement;
      return b.kills - a.kills;
    });

    // Assign ranks
    let currentRank = 1;
    for (let i = 0; i < standings.length; i++) {
      const standing = standings[i];
      
      // Check for ties
      if (i > 0) {
        const prevStanding = standings[i - 1];
        if (
          standing.points === prevStanding.points &&
          standing.wins === prevStanding.wins &&
          standing.avgPlacement === prevStanding.avgPlacement
        ) {
          standing.rank = prevStanding.rank; // Same rank for ties
        } else {
          standing.rank = currentRank;
        }
      } else {
        standing.rank = currentRank;
      }
      
      currentRank++;
      standing.status = StandingStatus.FINAL;
    }

    // Save all standings in a transaction
    await this.dataSource.transaction(async (manager) => {
      for (const standing of standings) {
        await manager.save(StandingEntity, standing);
      }
    });

    return standings;
  }

  async getTournamentStandings(
    tournamentId: string,
    options: {
      limit?: number;
      offset?: number;
      region?: string;
    } = {},
  ): Promise<{ standings: StandingEntity[]; total: number }> {
    const queryBuilder = this.standingRepo
      .createQueryBuilder('standing')
      .leftJoinAndSelect('standing.team', 'team')
      .leftJoinAndSelect('standing.user', 'user')
      .where('standing.tournamentId = :tournamentId', { tournamentId })
      .andWhere('standing.type = :type', { type: StandingType.TOURNAMENT })
      .andWhere('standing.status = :status', { status: StandingStatus.FINAL })
      .orderBy('standing.rank', 'ASC');

    if (options.region) {
      queryBuilder.andWhere('standing.region = :region', { region: options.region });
    }

    const total = await queryBuilder.getCount();

    if (options.limit) {
      queryBuilder.limit(options.limit);
    }

    if (options.offset !== undefined) {
      queryBuilder.offset(options.offset);
    }

    const standings = await queryBuilder.getMany();

    return { standings, total };
  }

  async recalculateStandings(tournamentId: string): Promise<void> {
    await this.calculateTournamentStandings(tournamentId);
  }

  private getCurrentSeason(): string {
    // Simple season calculation - could be more sophisticated
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    // Quarterly seasons
    const quarter = Math.floor(month / 3) + 1;
    return `${year}-Q${quarter}`;
  }

  async getParticipantStandings(
    participantId: string,
    type: 'team' | 'player',
    options: {
      seasonId?: string;
      tournamentId?: string;
      limit?: number;
    } = {},
  ): Promise<StandingEntity[]> {
    const queryBuilder = this.standingRepo
      .createQueryBuilder('standing')
      .where(
        type === 'team' ? 'standing.teamId = :participantId' : 'standing.userId = :participantId',
        { participantId },
      );

    if (options.seasonId) {
      queryBuilder.andWhere('standing.seasonId = :seasonId', { seasonId: options.seasonId });
    }

    if (options.tournamentId) {
      queryBuilder.andWhere('standing.tournamentId = :tournamentId', { tournamentId: options.tournamentId });
    }

    queryBuilder.orderBy('standing.createdAt', 'DESC');

    if (options.limit) {
      queryBuilder.limit(options.limit);
    }

    return queryBuilder.getMany();
  }
}
