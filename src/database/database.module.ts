import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  MatchEntity,
  NotificationEntity,
  PaymentRecordEntity,
  RegistrationEntity,
  TeamEntity,
  TournamentEntity,
  UserEntity,
} from './entities';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      TeamEntity,
      TournamentEntity,
      RegistrationEntity,
      MatchEntity,
      PaymentRecordEntity,
      NotificationEntity,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
