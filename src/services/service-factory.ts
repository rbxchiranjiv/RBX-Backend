import type { DataSource } from 'typeorm';
import type { GlobalConfig } from 'types/globalConfig';
import globalConfig from 'config/globalConfig';
import {
  MatchDisputeEntity,
  MatchEntity,
  MatchProofEntity,
  NotificationEntity,
  PaymentRecordEntity,
  RefreshTokenEntity,
  RegistrationEntity,
  TeamEntity,
  TournamentEntity,
  UserEntity,
} from '../database/entities';
import { UserService } from './user.service';
import { TeamService } from './team.service';
import { TournamentService } from './tournament.service';
import { RegistrationService } from './registration.service';
import { MatchService } from './match.service';
import { PaymentRecordService } from './payment-record.service';
import { NotificationService } from './notification.service';
import { AuthService } from './auth.service';
import { MatchLifecycleService } from './match-lifecycle.service';

export interface ServiceContainer {
  userService: UserService;
  teamService: TeamService;
  tournamentService: TournamentService;
  registrationService: RegistrationService;
  matchService: MatchService;
  matchLifecycleService: MatchLifecycleService;
  paymentRecordService: PaymentRecordService;
  notificationService: NotificationService;
  authService: AuthService;
  config: GlobalConfig;
}

export function createServiceContainer(dataSource: DataSource, config: GlobalConfig = globalConfig): ServiceContainer {
  const userRepo = dataSource.getRepository(UserEntity);
  const teamRepo = dataSource.getRepository(TeamEntity);
  const tournamentRepo = dataSource.getRepository(TournamentEntity);
  const registrationRepo = dataSource.getRepository(RegistrationEntity);
  const matchRepo = dataSource.getRepository(MatchEntity);
  const matchProofRepo = dataSource.getRepository(MatchProofEntity);
  const matchDisputeRepo = dataSource.getRepository(MatchDisputeEntity);
  const paymentRepo = dataSource.getRepository(PaymentRecordEntity);
  const notificationRepo = dataSource.getRepository(NotificationEntity);
  const refreshTokenRepo = dataSource.getRepository(RefreshTokenEntity);

  const notificationService = new NotificationService(notificationRepo, userRepo, tournamentRepo, matchRepo);

  return {
    userService: new UserService(userRepo),
    teamService: new TeamService(teamRepo, userRepo, config),
    tournamentService: new TournamentService(tournamentRepo, teamRepo, registrationRepo, userRepo, config),
    registrationService: new RegistrationService(registrationRepo, tournamentRepo, teamRepo, paymentRepo, config),
    matchService: new MatchService(matchRepo, tournamentRepo, registrationRepo, teamRepo, config),
    matchLifecycleService: new MatchLifecycleService(
      matchRepo,
      teamRepo,
      tournamentRepo,
      matchProofRepo,
      matchDisputeRepo,
      userRepo,
      notificationService,
      config,
    ),
    paymentRecordService: new PaymentRecordService(paymentRepo, userRepo, tournamentRepo, registrationRepo),
    notificationService,
    authService: new AuthService(userRepo, refreshTokenRepo),
    config,
  };
}
