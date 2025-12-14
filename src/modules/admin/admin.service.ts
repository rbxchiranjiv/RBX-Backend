import { Inject, Injectable } from '@nestjs/common';
import { GLOBAL_CONFIG } from '../../common/providers/global-config.provider';
import type { GlobalConfig } from 'types/globalConfig';
import { UpdateFeatureFlagDto } from './dto/update-feature-flag.dto';

export interface AdminServicePort {
  getFeatureFlags(): Promise<Record<string, boolean>>;
  updateFeatureFlag(payload: UpdateFeatureFlagDto): Promise<{ key: string; value: boolean }>;
}

@Injectable()
export class AdminService implements AdminServicePort {
  constructor(@Inject(GLOBAL_CONFIG) private readonly config: GlobalConfig) {}

  async getFeatureFlags() {
    return this.config.featureFlags;
  }

  async updateFeatureFlag(payload: UpdateFeatureFlagDto) {
    // TODO: persist flag changes in DB; currently echoes config
    return { key: payload.flagKey, value: payload.enabled };
  }
}
