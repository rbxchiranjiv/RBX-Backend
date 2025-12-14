import { Global, Module } from '@nestjs/common';
import { globalConfigProvider } from './providers/global-config.provider';

@Global()
@Module({
  providers: [globalConfigProvider],
  exports: [globalConfigProvider],
})
export class GlobalConfigModule {}
