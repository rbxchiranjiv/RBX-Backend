import { Inject, Injectable } from '@nestjs/common';
import { GLOBAL_CONFIG } from '../../common/providers/global-config.provider';
import type { GlobalConfig } from 'types/globalConfig';
import { CreateTournamentDto } from './dto/create-tournament.dto';

export interface TournamentsServicePort {
  create(payload: CreateTournamentDto): Promise<{ id: string; message: string }>;
  findOne(id: string): Promise<{ id: string; status: string }>;
}

@Injectable()
export class TournamentsService implements TournamentsServicePort {
  constructor(@Inject(GLOBAL_CONFIG) private readonly config: GlobalConfig) {}

  async create(payload: CreateTournamentDto) {
    const feeTier =
      payload.maxTeams <= 100
        ? this.config.organizer.creationFees.small
        : payload.maxTeams <= 500
        ? this.config.organizer.creationFees.medium
        : this.config.organizer.creationFees.large;

    return {
      id: 'tournament-stub',
      message: `Creation fee: ₹${feeTier} • Platform cut ${(this.config.tournament.platformCut * 100).toFixed(
        2,
      )}%`,
    };
  }

  async findOne(id: string) {
    return {
      id,
      status: `Max matches/day: ${this.config.tournament.maxMatchesPerDay}`,
    };
  }
}
