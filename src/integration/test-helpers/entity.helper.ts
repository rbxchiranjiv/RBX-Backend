import { Repository } from 'typeorm';
import { UserEntity } from '../../database/entities/user.entity';
import { TournamentEntity } from '../../database/entities/tournament.entity';
import { MatchEntity } from '../../database/entities/match.entity';
import { StandingEntity, StandingType, StandingStatus } from '../../database/entities/standing.entity';
import { RegistrationEntity } from '../../database/entities/registration.entity';
import { TeamEntity } from '../../database/entities/team.entity';

export async function createTestUser(userRepo: Repository<UserEntity>): Promise<UserEntity> {
  const user = userRepo.create({
    displayName: 'Test User',
    phoneNumber: '+1234567890',
    email: 'test@example.com',
    role: 'player',
    kycVerified: true,
  });
  return await userRepo.save(user);
}

export async function createTestTournament(
  tournamentRepo: Repository<TournamentEntity>,
  creator: UserEntity
): Promise<TournamentEntity> {
  const tournament = tournamentRepo.create({
    name: 'Test Tournament',
    slug: `test-tournament-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    mode: 'BR',
    status: 'open',
    entryFee: 0,
    creationFee: 0,
    prizePool: 1000,
    maxTeams: 100,
    organizer: creator,
  });
  return await tournamentRepo.save(tournament);
}

export async function createTestMatch(
  matchRepo: Repository<MatchEntity>,
  tournament: TournamentEntity
): Promise<MatchEntity> {
  const match = matchRepo.create({
    code: `MATCH-${Date.now()}`,
    mode: 'BR',
    status: 'scheduled',
    roundNumber: 1,
  });
  return await matchRepo.save(match);
}

export async function createTestMultipleUsers(
  userRepo: Repository<UserEntity>,
  count: number
): Promise<UserEntity[]> {
  const users: UserEntity[] = [];
  for (let i = 1; i <= count; i++) {
    const user = userRepo.create({
      displayName: `Test User ${i}`,
      phoneNumber: `+123456789${i}`,
      email: `test${i}@example.com`,
      role: 'player',
      kycVerified: true,
    });
    users.push(await userRepo.save(user));
  }
  return users;
}

export async function createTestMultipleTournaments(
  tournamentRepo: Repository<TournamentEntity>,
  creator: UserEntity,
  count: number
): Promise<TournamentEntity[]> {
  const tournaments: TournamentEntity[] = [];
  for (let i = 1; i <= count; i++) {
    const tournament = tournamentRepo.create({
      name: `Test Tournament ${i}`,
      slug: `test-tournament-${i}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      mode: 'BR',
      status: 'open',
      entryFee: 0,
      creationFee: 0,
      prizePool: 1000 * i,
      maxTeams: 100,
      organizer: creator,
    });
    tournaments.push(await tournamentRepo.save(tournament));
  }
  return tournaments;
}

export async function createTestStanding(
  standingRepo: Repository<StandingEntity>,
  tournamentRepo: Repository<TournamentEntity>,
  user: UserEntity,
  overrides: Partial<StandingEntity> = {}
): Promise<StandingEntity> {
  // Ensure tournament exists and relation is properly set
  let tournament: TournamentEntity | undefined = overrides.tournament;
  
  if (!tournament && overrides.tournamentId) {
    const found = await tournamentRepo.findOne({ where: { id: overrides.tournamentId } });
    if (found) {
      tournament = found;
    }
  }
  
  if (!tournament) {
    // Create a minimal tournament if none provided
    tournament = await createTestTournament(tournamentRepo, user);
  }

  const standing = standingRepo.create({
    tournamentId: tournament.id,
    tournament: tournament,
    userId: user.id,
    seasonId: '2024-Q1',
    type: StandingType.TOURNAMENT,
    status: StandingStatus.FINAL,
    rank: 1,
    points: 180,
    matchesPlayed: 1,
    wins: 1,
    losses: 0,
    draws: 0,
    kills: 10,
    deaths: 2,
    assists: 5,
    survivalTime: 1800,
    kdratio: 5.0,
    avgPlacement: 1.0,
    region: 'global',
    metadata: {},
    ...overrides,
  });

  // Ensure tournament relation is set for TypeORM to populate tournamentId
  if (!standing.tournament) {
    standing.tournament = tournament;
  }

  return await standingRepo.save(standing);
}

export async function createTestRegistration(
  registrationRepo: Repository<RegistrationEntity>,
  tournamentRepo: Repository<TournamentEntity>,
  teamRepo: Repository<TeamEntity>,
  user: UserEntity,
  overrides: Partial<RegistrationEntity> = {}
): Promise<RegistrationEntity> {
  // Ensure tournament exists and relation is properly set
  let tournament: TournamentEntity | undefined = overrides.tournament;
  
  if (!tournament && (overrides as any).tournamentId) {
    const found = await tournamentRepo.findOne({ where: { id: (overrides as any).tournamentId } });
    if (found) {
      tournament = found;
    }
  }
  
  if (!tournament) {
    // Create a minimal tournament if none provided
    tournament = await createTestTournament(tournamentRepo, user);
  }

  // Create a minimal team if none provided
  let team: TeamEntity | undefined = overrides.team;
  if (!team && (overrides as any).teamId) {
    const found = await teamRepo.findOne({ where: { id: (overrides as any).teamId } });
    if (found) {
      team = found;
    }
  }
  
  if (!team) {
    team = teamRepo.create({
      name: 'Test Team',
      slug: 'test-team',
      region: 'global',
      verified: false,
      owner: user,
      members: [user],
    });
    team = await teamRepo.save(team);
  }

  const registration = registrationRepo.create({
    status: 'confirmed',
    paymentStatus: 'paid',
    amountPaid: 0,
    invitedSlot: false,
    reshufflesUsed: 0,
    metadata: {},
    team: team,
    playerId: user.id,
    tournament: tournament,
    ...overrides,
  });

  // Ensure relations are set for TypeORM to populate foreign keys
  if (!registration.tournament) {
    registration.tournament = tournament;
  }
  if (!registration.team) {
    registration.team = team;
  }

  return await registrationRepo.save(registration);
}
