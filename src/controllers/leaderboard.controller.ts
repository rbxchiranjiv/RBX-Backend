import { Request, Response } from 'express';
import { LeaderboardService } from '../services/leaderboard.service';
import { StandingsService } from '../services/standings.service';
import { SeasonAggregationService } from '../services/season-aggregation.service';
import { validateDto } from '../utils/validation';
import { LeaderboardQueryOptions } from '../services/leaderboard.service';
import { SeasonStatsQueryOptions } from '../services/season-aggregation.service';
import { TournamentStandingsQueryOptions } from '../services/standings.service';

// Mock auth middleware for now
const requireAuth = (req: any, res: any, next: any) => next();
const requireRole = (...roles: any[]) => (req: any, res: any, next: any) => next();

import {
  GetLeaderboardDto,
  RefreshLeaderboardDto,
  GetStandingsDto,
  GetSeasonStatsDto,
  GetTopSeasonStatsDto,
  GetOrganizerStatsDto,
} from '../dto/leaderboard.dto';

export class LeaderboardController {
  constructor(
    private readonly leaderboardService: LeaderboardService,
    private readonly standingsService: StandingsService,
    private readonly seasonAggregationService: SeasonAggregationService,
  ) {}

  async getGlobalLeaderboard(req: Request, res: Response) {
    try {
      const query = await validateDto(GetLeaderboardDto, req.query);
      
      const options = {
        type: 'global' as any,
        category: query.category,
        seasonId: query.seasonId,
        region: query.region,
        limit: query.limit,
        offset: query.offset,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        filters: query.filters,
      };

      const result = await this.leaderboardService.getLeaderboard(options);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getSeasonLeaderboard(req: Request, res: Response) {
    try {
      const query = await validateDto(GetLeaderboardDto, req.query);
      const seasonId = req.params.seasonId;
      
      const options = {
        type: 'season' as any,
        category: query.category,
        seasonId,
        region: query.region,
        limit: query.limit,
        offset: query.offset,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        filters: query.filters,
      };

      const result = await this.leaderboardService.getLeaderboard(options);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getTournamentLeaderboard(req: Request, res: Response) {
    try {
      const query = await validateDto(GetLeaderboardDto, req.query);
      const tournamentId = req.params.tournamentId;
      
      const options = {
        type: 'tournament' as any,
        category: query.category,
        tournamentId,
        region: query.region,
        limit: query.limit,
        offset: query.offset,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        filters: query.filters,
      };

      const result = await this.leaderboardService.getLeaderboard(options);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async refreshLeaderboard(req: Request, res: Response) {
    try {
      const body = await validateDto(RefreshLeaderboardDto, req.body);
      
      const options = {
        type: body.type,
        category: body.category,
        seasonId: body.seasonId,
        tournamentId: body.tournamentId,
        region: body.region,
      };

      const result = await this.leaderboardService.refreshLeaderboard(options);
      return res.status(200).json({
        success: true,
        data: result,
        message: 'Leaderboard refreshed successfully',
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getTournamentStandings(req: Request, res: Response) {
    try {
      const query = await validateDto(GetStandingsDto, req.query);
      const tournamentId = req.params.tournamentId;
      
      const options = {
        limit: query.limit,
        offset: query.offset,
        region: query.region,
      };

      const result = await this.standingsService.getTournamentStandings(tournamentId, options);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getSeasonStats(req: Request, res: Response) {
    try {
      const query = await validateDto(GetSeasonStatsDto, req.query);
      const participantId = req.params.participantId;
      
      const stats = await this.seasonAggregationService.getSeasonStats(
        participantId,
        query.type,
        query.seasonId,
        query.region,
      );

      return res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getTopSeasonStats(req: Request, res: Response) {
    try {
      const query = await validateDto(GetTopSeasonStatsDto, req.query);
      const seasonId = query.seasonId || this.getCurrentSeason();
      
      const stats = await this.seasonAggregationService.getTopSeasonStats(seasonId, {
        limit: query.limit,
        region: query.region,
        category: query.category,
      });

      return res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getOrganizerStats(req: Request, res: Response) {
    try {
      const query = await validateDto(GetOrganizerStatsDto, req.query);
      const user = req.user as any;
      const seasonId = query.seasonId || this.getCurrentSeason();
      const region = query.region || 'global';

      // This would be implemented in OrganizerStatsService
      // For now, return a placeholder
      return res.status(200).json({
        success: true,
        data: {
          organizerId: user.id,
          seasonId,
          region,
          tournamentsOrganized: 0,
          totalParticipants: 0,
          averageRating: 0,
          organizerScore: 0,
        },
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getSeasonHistory(req: Request, res: Response) {
    try {
      const participantId = req.params.participantId;
      const type = req.query.type as 'team' | 'player';
      const limit = parseInt(req.query.limit as string) || 10;
      
      const history = await this.seasonAggregationService.getSeasonHistory(
        participantId,
        type,
        limit,
      );

      return res.status(200).json({
        success: true,
        data: history,
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getSeasonSummary(req: Request, res: Response) {
    try {
      const seasonId = req.params.seasonId;
      const region = req.query.region as string;
      
      const summary = await this.seasonAggregationService.getSeasonSummary(seasonId, region);

      return res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private getCurrentSeason(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const quarter = Math.floor(month / 3) + 1;
    return `${year}-Q${quarter}`;
  }
}
