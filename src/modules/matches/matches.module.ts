import { Module } from '@nestjs/common';
import { GlobalConfigModule } from '../../common/global-config.module';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

@Module({
  imports: [GlobalConfigModule],
  controllers: [MatchesController],
  providers: [MatchesService],
  exports: [MatchesService],
})
export class MatchesModule {}
