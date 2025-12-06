import { Repository } from 'typeorm';
import { UserEntity } from '../../database/entities/user.entity';
import { TournamentEntity } from '../../database/entities/tournament.entity';
import { MatchEntity } from '../../database/entities/match.entity';

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
    slug: 'test-tournament',
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
      slug: `test-tournament-${i}`,
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
