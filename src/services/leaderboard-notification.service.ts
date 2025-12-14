import { Injectable } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { LeaderboardService } from './leaderboard.service';
import { SeasonAggregationService } from './season-aggregation.service';
import { StandingEntity, LeaderboardType, LeaderboardCategory } from '../database/entities';

export interface RankingChangeNotification {
  participantId: string;
  participantType: 'team' | 'player';
  participantName: string;
  previousRank: number;
  currentRank: number;
  rankChange: number;
  leaderboardType: LeaderboardType;
  category: LeaderboardCategory;
  seasonId?: string;
  tournamentId?: string;
  region: string;
  points: number;
  achievements: string[];
}

export interface LeaderboardUpdateEvent {
  type: LeaderboardType;
  category: LeaderboardCategory;
  seasonId?: string;
  tournamentId?: string;
  region: string;
  affectedParticipants: RankingChangeNotification[];
  timestamp: Date;
}

@Injectable()
export class LeaderboardNotificationService {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly leaderboardService: LeaderboardService,
    private readonly seasonAggregationService: SeasonAggregationService,
  ) {}

  async notifyLeaderboardUpdate(event: LeaderboardUpdateEvent): Promise<void> {
    // Notify top 10 participants
    const topParticipants = event.affectedParticipants
      .filter(p => p.currentRank <= 10)
      .slice(0, 10);

    // Notify participants with significant rank changes
    const significantChanges = event.affectedParticipants
      .filter(p => Math.abs(p.rankChange) >= 5)
      .slice(0, 20);

    // Combine and deduplicate notifications
    const participantsToNotify = new Map<string, RankingChangeNotification>();
    
    topParticipants.forEach(p => participantsToNotify.set(p.participantId, p));
    significantChanges.forEach(p => participantsToNotify.set(p.participantId, p));

    // Send notifications
    for (const participant of participantsToNotify.values()) {
      await this.sendRankingChangeNotification(participant, event);
    }

    // Notify organizers of major ranking changes
    await this.notifyOrganizersOfMajorChanges(event);
  }

  private async sendRankingChangeNotification(
    participant: RankingChangeNotification,
    event: LeaderboardUpdateEvent,
  ): Promise<void> {
    const title = this.generateNotificationTitle(participant);
    const message = this.generateNotificationMessage(participant);
    const type = this.getNotificationType(participant);

    if (participant.participantType !== 'player') return; // Only send notifications to players

    await this.notificationService.create({
      userId: participant.participantId,
      templateKey: 'leaderboard_rank_change',
      channel: 'inApp',
      payload: {
        title,
        message,
        type,
        participantType: participant.participantType,
        participantId: participant.participantId,
        previousRank: participant.previousRank,
        currentRank: participant.currentRank,
        rankChange: participant.rankChange,
        points: participant.points,
      },
    });
  }

  private generateNotificationTitle(participant: RankingChangeNotification): string {
    if (participant.rankChange > 0) {
      return `🎯 Ranking Improved! You moved up ${participant.rankChange} positions`;
    } else if (participant.rankChange < 0) {
      return `📊 Ranking Update: You moved down ${Math.abs(participant.rankChange)} positions`;
    } else {
      return `📈 Current Ranking: #${participant.currentRank}`;
    }
  }

  private generateNotificationMessage(participant: RankingChangeNotification): string {
    const leaderboardName = this.getLeaderboardName(participant.leaderboardType);
    const rankChangeText = participant.rankChange !== 0 
      ? ` (${participant.rankChange > 0 ? '+' : ''}${participant.rankChange})`
      : '';

    let message = `Your current rank in ${leaderboardName} is #${participant.currentRank}${rankChangeText} with ${participant.points} points.`;

    if (participant.achievements.length > 0) {
      message += `\n\n🏆 New achievements: ${participant.achievements.join(', ')}`;
    }

    return message;
  }

  private getLeaderboardName(type: LeaderboardType): string {
    switch (type) {
      case LeaderboardType.GLOBAL:
        return 'Global Leaderboard';
      case LeaderboardType.SEASON:
        return 'Season Leaderboard';
      case LeaderboardType.TOURNAMENT:
        return 'Tournament Leaderboard';
      default:
        return 'Leaderboard';
    }
  }

  private getNotificationType(participant: RankingChangeNotification): string {
    if (participant.rankChange > 5) {
      return 'ranking_improvement';
    } else if (participant.rankChange < -5) {
      return 'ranking_decline';
    } else if (participant.currentRank <= 10) {
      return 'top_rank';
    } else if (participant.achievements.length > 0) {
      return 'achievement';
    } else {
      return 'ranking_update';
    }
  }

  private getNotificationPriority(participant: RankingChangeNotification): 'low' | 'medium' | 'high' {
    if (participant.currentRank <= 3) return 'high';
    if (participant.currentRank <= 10 || Math.abs(participant.rankChange) >= 10) return 'medium';
    return 'low';
  }

  private async notifyOrganizersOfMajorChanges(event: LeaderboardUpdateEvent): Promise<void> {
    // Find organizers who should be notified
    // This would depend on the tournament/season context
    const organizerIds = await this.getRelevantOrganizerIds(event);

    for (const organizerId of organizerIds) {
      await this.sendOrganizerNotification(event, organizerId);
    }
  }

  private async sendOrganizerNotification(event: LeaderboardUpdateEvent, organizerId: string): Promise<void> {
    const title = `📊 Leaderboard Update: ${this.getLeaderboardName(event.type)}`;
    
    const topChanges = event.affectedParticipants
      .filter(p => Math.abs(p.rankChange) >= 3)
      .slice(0, 5);

    let message = `The leaderboard has been updated with ${event.affectedParticipants.length} participants affected.`;

    if (topChanges.length > 0) {
      message += '\n\nNotable changes:\n';
      topChanges.forEach(p => {
        const arrow = p.rankChange > 0 ? '↑' : '↓';
        message += `• ${p.participantName}: #${p.currentRank} ${arrow}${Math.abs(p.rankChange)}\n`;
      });
    }

    await this.notificationService.create({
      userId: organizerId,
      templateKey: 'leaderboard_update',
      channel: 'inApp',
      payload: {
        title,
        message,
        type: 'leaderboard_update',
        leaderboardEvent: event,
        topChanges,
      },
    });
  }

  private async getRelevantOrganizerIds(event: LeaderboardUpdateEvent): Promise<string[]> {
    // This would query for organizers based on tournament/season
    // For now, return empty array - would be implemented based on organizer relationships
    return [];
  }

  async processTournamentStandingsUpdate(tournamentId: string, standings: StandingEntity[]): Promise<void> {
    // Create ranking change notifications for tournament leaderboard
    const rankingChanges = await this.calculateRankingChanges(
      standings,
      LeaderboardType.TOURNAMENT,
      LeaderboardCategory.TEAMS, // or determine based on standings
      undefined,
      tournamentId,
      'global',
    );

    const event: LeaderboardUpdateEvent = {
      type: LeaderboardType.TOURNAMENT,
      category: LeaderboardCategory.TEAMS,
      tournamentId,
      region: 'global',
      affectedParticipants: rankingChanges,
      timestamp: new Date(),
    };

    await this.notifyLeaderboardUpdate(event);
  }

  async processSeasonRankingsUpdate(seasonId: string, region: string = 'global'): Promise<void> {
    // Get current season rankings
    const teamStats = await this.seasonAggregationService.getTopSeasonStats(seasonId, {
      region,
      category: 'team',
      limit: 100,
    });

    const playerStats = await this.seasonAggregationService.getTopSeasonStats(seasonId, {
      region,
      category: 'player',
      limit: 100,
    });

    // Process team rankings
    const teamRankingChanges = await this.calculateRankingChanges(
      teamStats,
      LeaderboardType.SEASON,
      LeaderboardCategory.TEAMS,
      seasonId,
      undefined,
      region,
    );

    // Process player rankings
    const playerRankingChanges = await this.calculateRankingChanges(
      playerStats,
      LeaderboardType.SEASON,
      LeaderboardCategory.PLAYERS,
      seasonId,
      undefined,
      region,
    );

    // Create events and send notifications
    if (teamRankingChanges.length > 0) {
      const teamEvent: LeaderboardUpdateEvent = {
        type: LeaderboardType.SEASON,
        category: LeaderboardCategory.TEAMS,
        seasonId,
        region,
        affectedParticipants: teamRankingChanges,
        timestamp: new Date(),
      };

      await this.notifyLeaderboardUpdate(teamEvent);
    }

    if (playerRankingChanges.length > 0) {
      const playerEvent: LeaderboardUpdateEvent = {
        type: LeaderboardType.SEASON,
        category: LeaderboardCategory.PLAYERS,
        seasonId,
        region,
        affectedParticipants: playerRankingChanges,
        timestamp: new Date(),
      };

      await this.notifyLeaderboardUpdate(playerEvent);
    }
  }

  private async calculateRankingChanges(
    currentStandings: Array<StandingEntity | any>,
    type: LeaderboardType,
    category: LeaderboardCategory,
    seasonId?: string,
    tournamentId?: string,
    region: string = 'global',
  ): Promise<RankingChangeNotification[]> {
    const changes: RankingChangeNotification[] = [];

    for (const standing of currentStandings) {
      // Get previous ranking for comparison
      const previousRanking = await this.getPreviousRanking(
        standing.teamId || standing.userId,
        standing.teamId ? 'team' : 'player',
        type,
        category,
        seasonId,
        tournamentId,
        region,
      );

      const currentRank = standing.rank || standing.currentRank;
      const previousRank = previousRanking?.rank || currentRank;
      const rankChange = previousRank - currentRank; // Positive means improvement

      const participant: RankingChangeNotification = {
        participantId: standing.teamId || standing.userId,
        participantType: standing.teamId ? 'team' : 'player',
        participantName: standing.team?.name || standing.user?.displayName || 'Unknown',
        previousRank,
        currentRank,
        rankChange,
        leaderboardType: type,
        category,
        seasonId,
        tournamentId,
        region,
        points: standing.points || standing.totalPoints || 0,
        achievements: this.getNewAchievements(standing, previousRanking),
      };

      changes.push(participant);
    }

    return changes;
  }

  private async getPreviousRanking(
    participantId: string,
    participantType: 'team' | 'player',
    type: LeaderboardType,
    category: LeaderboardCategory,
    seasonId?: string,
    tournamentId?: string,
    region: string = 'global',
  ): Promise<{ rank: number; timestamp: Date } | null> {
    // This would query historical rankings from snapshots or season stats
    // For now, return null - would be implemented with proper historical data
    return null;
  }

  private getNewAchievements(standing: any, previousRanking: any): string[] {
    const achievements: string[] = [];

    if (standing.rank === 1) achievements.push('First Place');
    if (standing.rank <= 3) achievements.push('Top 3');
    if (standing.rank <= 5) achievements.push('Top 5');
    if (standing.rank <= 10) achievements.push('Top 10');

    // Check for new achievements based on stats
    if (standing.achievements) {
      // Compare with previous achievements to find new ones
      // This would be implemented with proper achievement tracking
    }

    return achievements;
  }
}
