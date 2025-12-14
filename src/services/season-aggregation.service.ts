import { Repository, DataSource } from 'typeorm';
import { Injectable } from '@nestjs/common';
import {
  SeasonStatsEntity,
  StandingEntity,
  StandingType,
  StandingStatus,
  TournamentEntity,
  MatchEntity,
  TeamEntity,
  UserEntity,
  RegistrationEntity,
} from '../database/entities';

export interface SeasonAggregationOptions {
  seasonId?: string;
  region?: string;
  recalculateAll?: boolean;
}

export interface SeasonStatsQueryOptions {
  seasonId?: string;
  region?: string;
  limit?: number;
  offset?: number;
}

export interface WeeklyStats {
  week: string;
  points: number;
  rank: number;
  tournaments: number;
  wins: number;
  losses: number;
}

export interface Achievement {
  firstPlace: number;
  top3: number;
  top5: number;
  top10: number;
  perfectGames: number;
  longestWinStreak: number;
  currentWinStreak: number;
  firstTournament: boolean;
  tenTournaments: boolean;
  hundredTournaments: boolean;
}

@Injectable()
export class SeasonAggregationService {
  constructor(
    private readonly seasonStatsRepo: Repository<SeasonStatsEntity>,
    private readonly standingRepo: Repository<StandingEntity>,
    private readonly tournamentRepo: Repository<TournamentEntity>,
    private readonly matchRepo: Repository<MatchEntity>,
    private readonly teamRepo: Repository<TeamEntity>,
    private readonly userRepo: Repository<UserEntity>,
    private readonly registrationRepo: Repository<RegistrationEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async updateSeasonStats(
    tournamentId: string,
    options: SeasonAggregationOptions = {},
  ): Promise<void> {
    const tournament = await this.tournamentRepo.findOne({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new Error(`Tournament ${tournamentId} not found`);
    }

    const seasonId = options.seasonId || this.getCurrentSeason();
    const region = options.region || 'global';

    // Get all tournament standings
    const tournamentStandings = await this.standingRepo.find({
      where: {
        tournamentId,
        type: StandingType.TOURNAMENT,
        status: StandingStatus.FINAL,
      },
      relations: ['team', 'user'],
    });

    // Update season stats for each participant
    await this.dataSource.transaction(async (manager) => {
      for (const standing of tournamentStandings) {
        await this.updateParticipantSeasonStats(standing, seasonId, region, manager);
      }
    });
  }

  private async updateParticipantSeasonStats(
    standing: StandingEntity,
    seasonId: string,
    region: string,
    manager: any,
  ): Promise<void> {
    const participantId = standing.teamId || standing.userId;
    const participantType = standing.teamId ? 'team' : 'player';

    // Get or create season stats
    let seasonStats = await manager.findOne(SeasonStatsEntity, {
      where: {
        seasonId,
        type: participantType,
        ...(standing.teamId && { teamId: standing.teamId }),
        ...(standing.userId && { userId: standing.userId }),
        region,
      },
    });

    if (!seasonStats) {
      seasonStats = manager.create(SeasonStatsEntity, {
        seasonId,
        type: participantType,
        ...(standing.teamId && { teamId: standing.teamId }),
        ...(standing.userId && { userId: standing.userId }),
        region,
        tournamentsPlayed: 0,
        tournamentsWon: 0,
        totalPoints: 0,
        avgPlacement: 0,
        currentRank: 0,
        peakRank: 0,
        winRate: 0,
        totalMatches: 0,
        totalWins: 0,
        totalLosses: 0,
        totalDraws: 0,
        totalKills: 0,
        totalDeaths: 0,
        totalAssists: 0,
        totalSurvivalTime: 0,
        avgKills: 0,
        kdratio: 0,
        totalRoundsWon: 0,
        totalRoundsLost: 0,
        totalADR: 0,
        avgADR: 0,
        totalHSPercentage: 0,
        avgHSPercentage: 0,
        weeklyStats: {},
        achievements: this.getDefaultAchievements(),
        metadata: {},
      });
    }

    // Update tournament statistics
    seasonStats.tournamentsPlayed++;
    if (standing.rank === 1) {
      seasonStats.tournamentsWon++;
    }

    seasonStats.totalPoints += standing.points;

    // Update match statistics
    seasonStats.totalMatches += standing.matchesPlayed;
    seasonStats.totalWins += standing.wins;
    seasonStats.totalLosses += standing.losses;
    seasonStats.totalDraws += standing.draws;

    // Update combat statistics
    seasonStats.totalKills += standing.kills;
    seasonStats.totalDeaths += standing.deaths;
    seasonStats.totalAssists += standing.assists;
    seasonStats.totalSurvivalTime += standing.survivalTime;

    // Update CS-specific statistics
    seasonStats.totalRoundsWon += standing.roundsWon;
    seasonStats.totalRoundsLost += standing.roundsLost;
    seasonStats.totalADR += standing.adr * standing.matchesPlayed; // Convert to total
    seasonStats.totalHSPercentage += standing.hsPercentage * standing.matchesPlayed;

    // Calculate averages
    if (seasonStats.totalMatches > 0) {
      seasonStats.avgKills = Number((seasonStats.totalKills / seasonStats.totalMatches).toFixed(2));
      seasonStats.winRate = Number(((seasonStats.totalWins / seasonStats.totalMatches) * 100).toFixed(2));
      seasonStats.avgADR = Number((seasonStats.totalADR / seasonStats.totalMatches).toFixed(2));
      seasonStats.avgHSPercentage = Number((seasonStats.totalHSPercentage / seasonStats.totalMatches).toFixed(2));
    }

    if (seasonStats.totalDeaths > 0) {
      seasonStats.kdratio = Number((seasonStats.totalKills / seasonStats.totalDeaths).toFixed(2));
    } else if (seasonStats.totalKills > 0) {
      seasonStats.kdratio = seasonStats.totalKills;
    }

    // Update average placement
    if (seasonStats.tournamentsPlayed > 0) {
      seasonStats.avgPlacement = Number(
        ((seasonStats.avgPlacement * (seasonStats.tournamentsPlayed - 1) + standing.rank) / seasonStats.tournamentsPlayed).toFixed(2),
      );
    }

    // Update weekly stats
    this.updateWeeklyStats(seasonStats, standing);

    // Update achievements
    this.updateAchievements(seasonStats, standing);

    // Update metadata
    seasonStats.metadata[`tournament_${standing.tournamentId}`] = {
      rank: standing.rank,
      points: standing.points,
      wins: standing.wins,
      losses: standing.losses,
      avgPlacement: standing.avgPlacement,
      stats: {
        kills: standing.kills,
        deaths: standing.deaths,
        assists: standing.assists,
        kdratio: standing.kdratio,
      },
    };

    await manager.save(SeasonStatsEntity, seasonStats);
  }

  private updateWeeklyStats(seasonStats: SeasonStatsEntity, standing: StandingEntity): void {
    const currentWeek = this.getCurrentWeek();
    
    if (!seasonStats.weeklyStats[currentWeek]) {
      seasonStats.weeklyStats[currentWeek] = {
        week: currentWeek,
        points: 0,
        rank: 0,
        tournaments: 0,
        wins: 0,
        losses: 0,
      };
    }

    const weeklyStats = seasonStats.weeklyStats[currentWeek];
    weeklyStats.points += standing.points;
    weeklyStats.rank = standing.rank; // Latest rank
    weeklyStats.tournaments++;
    weeklyStats.wins += standing.wins;
    weeklyStats.losses += standing.losses;
  }

  private updateAchievements(seasonStats: SeasonStatsEntity, standing: StandingEntity): void {
    const achievements = seasonStats.achievements as Achievement;

    // First tournament
    if (seasonStats.tournamentsPlayed === 1) {
      achievements.firstTournament = true;
    }

    // Tournament milestones
    if (seasonStats.tournamentsPlayed === 10) {
      achievements.tenTournaments = true;
    }
    if (seasonStats.tournamentsPlayed === 100) {
      achievements.hundredTournaments = true;
    }

    // Placement achievements
    if (standing.rank === 1) {
      achievements.firstPlace++;
      achievements.currentWinStreak++;
      achievements.longestWinStreak = Math.max(
        achievements.longestWinStreak,
        achievements.currentWinStreak,
      );
    } else {
      achievements.currentWinStreak = 0;
    }

    if (standing.rank <= 3) achievements.top3++;
    if (standing.rank <= 5) achievements.top5++;
    if (standing.rank <= 10) achievements.top10++;

    // Perfect game (1st place with 0 deaths for BR, or clutch win for CS)
    if (standing.rank === 1 && standing.deaths === 0) {
      achievements.perfectGames++;
    }
  }

  private getDefaultAchievements(): Achievement {
    return {
      firstPlace: 0,
      top3: 0,
      top5: 0,
      top10: 0,
      perfectGames: 0,
      longestWinStreak: 0,
      currentWinStreak: 0,
      firstTournament: false,
      tenTournaments: false,
      hundredTournaments: false,
    };
  }

  async calculateSeasonRankings(
    seasonId: string,
    options: { region?: string; category?: 'team' | 'player' } = {},
  ): Promise<void> {
    const region = options.region || 'global';
    const category = options.category;

    let queryBuilder = this.seasonStatsRepo
      .createQueryBuilder('stats')
      .where('stats.seasonId = :seasonId', { seasonId })
      .andWhere('stats.region = :region', { region });

    if (category === 'team') {
      queryBuilder.andWhere('stats.teamId IS NOT NULL');
    } else if (category === 'player') {
      queryBuilder.andWhere('stats.userId IS NOT NULL');
    }

    const allStats = await queryBuilder.getMany();

    // Sort by points, then by win rate, then by average placement
    allStats.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      if (a.avgPlacement !== b.avgPlacement) return a.avgPlacement - b.avgPlacement;
      return (b.tournamentsWon || 0) - (a.tournamentsWon || 0);
    });

    // Assign ranks
    let currentRank = 1;
    for (let i = 0; i < allStats.length; i++) {
      const stats = allStats[i];
      
      // Check for ties
      if (i > 0) {
        const prevStats = allStats[i - 1];
        if (
          stats.totalPoints === prevStats.totalPoints &&
          stats.winRate === prevStats.winRate &&
          stats.avgPlacement === prevStats.avgPlacement
        ) {
          stats.currentRank = prevStats.currentRank;
        } else {
          stats.currentRank = currentRank;
        }
      } else {
        stats.currentRank = currentRank;
      }

      // Update peak rank
      if (stats.peakRank === 0 || stats.currentRank < stats.peakRank) {
        stats.peakRank = stats.currentRank;
      }

      currentRank++;
    }

    // Save updated rankings
    await this.dataSource.transaction(async (manager) => {
      for (const stats of allStats) {
        await manager.save(SeasonStatsEntity, stats);
      }
    });
  }

  async getSeasonStats(
    participantId: string,
    type: 'team' | 'player',
    seasonId?: string,
    region?: string,
  ): Promise<SeasonStatsEntity | null> {
    const queryBuilder = this.seasonStatsRepo
      .createQueryBuilder('stats')
      .leftJoinAndSelect('stats.team', 'team')
      .leftJoinAndSelect('stats.user', 'user')
      .where(
        type === 'team' ? 'stats.teamId = :participantId' : 'stats.userId = :participantId',
        { participantId },
      )
      .andWhere('stats.type = :type', { type });

    if (seasonId) {
      queryBuilder.andWhere('stats.seasonId = :seasonId', { seasonId });
    }

    if (region) {
      queryBuilder.andWhere('stats.region = :region', { region });
    }

    return queryBuilder.orderBy('stats.createdAt', 'DESC').getOne();
  }

  async getTopSeasonStats(
    seasonId: string,
    options: {
      limit?: number;
      region?: string;
      category?: 'team' | 'player';
    } = {},
  ): Promise<SeasonStatsEntity[]> {
    const limit = options.limit || 50;
    const region = options.region || 'global';
    const category = options.category;

    let queryBuilder = this.seasonStatsRepo
      .createQueryBuilder('stats')
      .leftJoinAndSelect('stats.team', 'team')
      .leftJoinAndSelect('stats.user', 'user')
      .where('stats.seasonId = :seasonId', { seasonId })
      .andWhere('stats.region = :region', { region })
      .orderBy('stats.currentRank', 'ASC')
      .limit(limit);

    if (category === 'team') {
      queryBuilder.andWhere('stats.teamId IS NOT NULL');
    } else if (category === 'player') {
      queryBuilder.andWhere('stats.userId IS NOT NULL');
    }

    return queryBuilder.getMany();
  }

  async getSeasonHistory(
    participantId: string,
    type: 'team' | 'player',
    limit: number = 10,
  ): Promise<SeasonStatsEntity[]> {
    return this.seasonStatsRepo.find({
      where: {
        ...(type === 'team' ? { teamId: participantId } : { userId: participantId }),
        type,
      },
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['team', 'user'],
    });
  }

  async recalculateAllSeasonStats(seasonId: string): Promise<void> {
    // Get all tournaments for the season
    const tournaments = await this.tournamentRepo.find({
      where: {
        // Assuming tournaments have a seasonId field or we can determine it from dates
      },
    });

    // Clear existing season stats for the season
    await this.seasonStatsRepo.delete({
      seasonId,
    });

    // Recalculate for each tournament
    for (const tournament of tournaments) {
      await this.updateSeasonStats(tournament.id, { seasonId });
    }

    // Recalculate rankings
    await this.calculateSeasonRankings(seasonId);
  }

  private getCurrentSeason(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const quarter = Math.floor(month / 3) + 1;
    return `${year}-Q${quarter}`;
  }

  private getCurrentWeek(): string {
    const now = new Date();
    const year = now.getFullYear();
    const week = this.getWeekNumber(now);
    return `${year}-W${week}`;
  }

  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  async getSeasonSummary(seasonId: string, region?: string): Promise<{
    totalParticipants: number;
    totalTeams: number;
    totalPlayers: number;
    totalTournaments: number;
    totalMatches: number;
    averagePoints: number;
    topPerformers: {
      teams: SeasonStatsEntity[];
      players: SeasonStatsEntity[];
    };
  }> {
    const regionFilter = region || 'global';

    const [teamStats, playerStats] = await Promise.all([
      this.seasonStatsRepo.find({
        where: { seasonId, type: 'team', region: regionFilter },
        order: { currentRank: 'ASC' },
        take: 10,
        relations: ['team'],
      }),
      this.seasonStatsRepo.find({
        where: { seasonId, type: 'player', region: regionFilter },
        order: { currentRank: 'ASC' },
        take: 10,
        relations: ['user'],
      }),
    ]);

    const totalTeams = teamStats.length;
    const totalPlayers = playerStats.length;
    const totalParticipants = totalTeams + totalPlayers;

    const allStats = [...teamStats, ...playerStats];
    const totalPoints = allStats.reduce((sum, stat) => sum + stat.totalPoints, 0);
    const averagePoints = totalParticipants > 0 ? totalPoints / totalParticipants : 0;

    // Get tournament and match counts
    const tournamentCount = await this.tournamentRepo.count({
      where: {
        // Filter by season if available
      },
    });

    const matchCount = await this.matchRepo.count({
      where: {
        // Filter by season if available
      },
    });

    return {
      totalParticipants,
      totalTeams,
      totalPlayers,
      totalTournaments: tournamentCount,
      totalMatches: matchCount,
      averagePoints: Number(averagePoints.toFixed(2)),
      topPerformers: {
        teams: teamStats,
        players: playerStats,
      },
    };
  }
}
