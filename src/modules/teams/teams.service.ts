import { Inject, Injectable } from '@nestjs/common';
import { GLOBAL_CONFIG } from '../../common/providers/global-config.provider';
import type { GlobalConfig } from 'types/globalConfig';
import { CreateTeamDto } from './dto/create-team.dto';

export interface TeamsServicePort {
  create(payload: CreateTeamDto): Promise<{ message: string; team: CreateTeamDto }>;
  getTeam(id: string): Promise<{ id: string; invitationNote: string }>;
}

@Injectable()
export class TeamsService implements TeamsServicePort {
  constructor(@Inject(GLOBAL_CONFIG) private readonly config: GlobalConfig) {}

  async create(payload: CreateTeamDto) {
    return {
      message: this.config.tournament.text.registrationSuccess,
      team: payload,
    };
  }

  async getTeam(id: string) {
    return {
      id,
      invitationNote: `${this.config.tournament.invitedSlots.inviteCodePrefix}${id}`,
    };
  }
}
