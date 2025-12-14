import { Provider } from '@nestjs/common';
import globalConfig from 'config/globalConfig';
import type { GlobalConfig } from 'types/globalConfig';

export const GLOBAL_CONFIG = Symbol('GLOBAL_CONFIG');

export const globalConfigProvider: Provider<GlobalConfig> = {
  provide: GLOBAL_CONFIG,
  useValue: globalConfig,
};
