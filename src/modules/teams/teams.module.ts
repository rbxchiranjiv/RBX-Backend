import { Module } from '@nestjs/common';
import { GlobalConfigModule } from '../../common/global-config.module';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  imports: [GlobalConfigModule],
  controllers: [TeamsController],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
