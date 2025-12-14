import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { GlobalConfigModule } from './common/global-config.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TournamentsModule } from './modules/tournaments/tournaments.module';
import { TeamsModule } from './modules/teams/teams.module';
import { MatchesModule } from './modules/matches/matches.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AdminModule } from './modules/admin/admin.module';
import { WalletModule } from './modules/wallet.module';

@Module({
  imports: [
    GlobalConfigModule,
    AuthModule,
    UsersModule,
    TournamentsModule,
    TeamsModule,
    MatchesModule,
    PaymentsModule,
    AdminModule,
    WalletModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
