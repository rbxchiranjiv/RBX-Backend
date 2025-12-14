import { Inject, Injectable } from '@nestjs/common';
import { GLOBAL_CONFIG } from '../../common/providers/global-config.provider';
import type { GlobalConfig } from 'types/globalConfig';
import { ScheduleMatchDto } from './dto/schedule-match.dto';

export interface MatchesServicePort {
  schedule(payload: ScheduleMatchDto): Promise<{ message: string; slot: string }>;
  getStatus(id: string): Promise<{ id: string; state: string }>;
}

@Injectable()
export class MatchesService implements MatchesServicePort {
  constructor(@Inject(GLOBAL_CONFIG) private readonly config: GlobalConfig) {}

  async schedule(payload: ScheduleMatchDto) {
    const buffer = this.config.tournament.defaultBufferMinutes;
    return {
      message: `Match scheduled with ${buffer}m buffer via ${payload.mode}.`,
      slot: payload.scheduledAt,
    };
  }

  async getStatus(id: string) {
    return {
      id,
      state: `Reminder cadence: ${this.config.notifications.thirtyMinReminderTime}/${this.config.notifications.fiveMinReminderTime}`,
    };
  }
}
