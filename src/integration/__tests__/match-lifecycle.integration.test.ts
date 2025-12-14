import request from 'supertest';
import type { DataSource, Repository } from 'typeorm';
import { createApp } from '../../app';
import { createTestDataSource, destroyTestDataSource } from '../../services/test-utils';
import { UserEntity } from '../../database/entities/user.entity';
import { MatchEntity } from '../../database/entities/match.entity';
import { MatchProofEntity } from '../../database/entities/match-proof.entity';
import { MatchDisputeEntity } from '../../database/entities/match-dispute.entity';
import { TournamentEntity } from '../../database/entities/tournament.entity';

const hourMs = 60 * 60 * 1000;

describe('Match lifecycle integration', () => {
  let dataSource: DataSource;
  let agent: request.SuperTest<request.Test>;
  let userRepo: Repository<UserEntity>;
  let matchRepo: Repository<MatchEntity>;
  let proofRepo: Repository<MatchProofEntity>;
  let disputeRepo: Repository<MatchDisputeEntity>;
  let tournamentRepo: Repository<TournamentEntity>;
  let phoneSequence = 9700000000;

  const nextPhone = () => (phoneSequence++).toString();
  const bearer = (token: string) => `Bearer ${token}`;

  beforeEach(async () => {
    dataSource = await createTestDataSource();
    agent = request(createApp(dataSource));
    userRepo = dataSource.getRepository(UserEntity);
    matchRepo = dataSource.getRepository(MatchEntity);
    proofRepo = dataSource.getRepository(MatchProofEntity);
    disputeRepo = dataSource.getRepository(MatchDisputeEntity);
    tournamentRepo = dataSource.getRepository(TournamentEntity);
  });

  afterEach(async () => {
    await destroyTestDataSource(dataSource);
  });

  const loginUser = async (phoneNumber: string) => {
    const response = await agent.post('/api/v1/auth/login').send({ phoneNumber }).expect(200);
    return response.body.data as {
      accessToken: string;
      refreshToken: string;
      user: UserEntity;
    };
  };

  const loginAsRole = async (role: UserEntity['role'], phoneNumber = nextPhone()) => {
    let auth = await loginUser(phoneNumber);
    if (auth.user.role !== role) {
      await userRepo.update(auth.user.id, { role });
      auth = await loginUser(phoneNumber);
    }
    return auth;
  };

  const createTeam = async (ownerAuth: Awaited<ReturnType<typeof loginUser>>, prefix: string) => {
    const memberIds = [] as string[];
    for (let i = 0; i < 4; i += 1) {
      const member = await loginAsRole('player');
      memberIds.push(member.user.id);
    }
    const slug = `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 16);
    const response = await agent
      .post('/api/v1/teams')
      .set('Authorization', bearer(ownerAuth.accessToken))
      .send({
        name: `Team-${slug}`,
        slug,
        region: 'IN',
        ownerId: ownerAuth.user.id,
        memberIds,
      })
      .expect(201);
    return response.body.data as { id: string; name: string };
  };

  const createTournament = async (organizerAuth: Awaited<ReturnType<typeof loginUser>>) => {
    const payload = {
      name: `Lifecycle Cup ${Date.now()}`,
      slug: `lifecycle-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      mode: 'BR' as const,
      organizerId: organizerAuth.user.id,
      entryFee: 0,
      creationFee: 50,
      prizePool: 1000,
      maxTeams: 64,
      invitesEnabled: true,
    };

    const response = await agent
      .post('/api/v1/tournaments')
      .set('Authorization', bearer(organizerAuth.accessToken))
      .send(payload)
      .expect(201);
    const tournament = response.body.data as { id: string };

    await agent
      .post(`/api/v1/tournaments/${tournament.id}/publish`)
      .set('Authorization', bearer(organizerAuth.accessToken))
      .expect(200);

    return tournament;
  };

  const createMatch = async (
    organizerAuth: Awaited<ReturnType<typeof loginUser>>,
    tournamentId: string,
    participants: string[],
  ) => {
    const response = await agent
      .post('/api/v1/matches')
      .set('Authorization', bearer(organizerAuth.accessToken))
      .send({
        tournamentId,
        code: `MATCH-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        mode: 'BR',
        scheduledAt: new Date(Date.now() + hourMs).toISOString(),
        participants,
      })
      .expect(201);
    return response.body.data as { id: string };
  };

  it('runs organizer start/end flow and lets admins finalize results', async () => {
    const admin = await loginAsRole('admin');
    const organizer = await loginAsRole('organizer');
    const teamOwnerA = await loginAsRole('player');
    const teamOwnerB = await loginAsRole('player');

    const teamA = await createTeam(teamOwnerA, 'alpha');
    const teamB = await createTeam(teamOwnerB, 'bravo');
    const tournament = await createTournament(organizer);
    const match = await createMatch(organizer, tournament.id, [teamA.id, teamB.id]);

    const startResponse = await agent
      .post(`/api/v1/matches/${match.id}/start`)
      .set('Authorization', bearer(organizer.accessToken))
      .send({ roomId: 'ROOM-1', roomPassword: 'secret' })
      .expect(200);
    expect(startResponse.body.data.status).toBe('ongoing');
    expect(startResponse.body.data.startedAt).toBeTruthy();

    const endResponse = await agent
      .post(`/api/v1/matches/${match.id}/end`)
      .set('Authorization', bearer(organizer.accessToken))
      .send({
        winnerTeamId: teamA.id,
        resultPayload: { kills: 15 },
        proofUrl: 'https://cdn.test/proof-a.png',
        reason: 'dominant win',
      })
      .expect(200);
    expect(endResponse.body.data.status).toBe('ended');
    expect(endResponse.body.data.endedAt).toBeTruthy();

    const proofs = await proofRepo.find({ where: { match: { id: match.id } } });
    expect(proofs).toHaveLength(1);
    expect(proofs[0].url).toBe('https://cdn.test/proof-a.png');

    const finalizeResponse = await agent
      .post(`/api/v1/matches/${match.id}/finalize`)
      .set('Authorization', bearer(admin.accessToken))
      .send({ adminDecision: { notes: 'verified' } })
      .expect(200);
    expect(finalizeResponse.body.data.status).toBe('result_confirmed');

    const persistedMatch = await matchRepo.findOne({
      where: { id: match.id },
      relations: ['finalWinnerTeam', 'provisionalWinnerTeam'],
    });
    expect(persistedMatch?.finalWinnerTeam?.id).toBe(teamA.id);

    const persistedTournament = await tournamentRepo.findOne({ where: { id: tournament.id } });
    const tournamentMetadata = persistedTournament?.metadata as Record<string, unknown> | undefined;
    const lastResult = tournamentMetadata?.lastResult as { winnerTeamId?: string } | undefined;
    expect(lastResult?.winnerTeamId).toBe(teamA.id);
  });

  it('lets participants upload proofs, dispute results, and rerun matches via admin resolution', async () => {
    const admin = await loginAsRole('admin');
    const organizer = await loginAsRole('organizer');
    const teamOwnerA = await loginAsRole('player');
    const teamOwnerB = await loginAsRole('player');

    const teamA = await createTeam(teamOwnerA, 'charlie');
    const teamB = await createTeam(teamOwnerB, 'delta');
    const tournament = await createTournament(organizer);
    const match = await createMatch(organizer, tournament.id, [teamA.id, teamB.id]);

    await agent
      .post(`/api/v1/matches/${match.id}/start`)
      .set('Authorization', bearer(organizer.accessToken))
      .expect(200);

    await agent
      .post(`/api/v1/matches/${match.id}/end`)
      .set('Authorization', bearer(organizer.accessToken))
      .send({ winnerTeamId: teamA.id, resultPayload: { duration: 20 } })
      .expect(200);

    const proofResponse = await agent
      .post(`/api/v1/matches/${match.id}/proofs`)
      .set('Authorization', bearer(teamOwnerB.accessToken))
      .send({
        proofUrl: 'https://cdn.test/loser-proof.png',
        metadata: { perspective: 'loser' },
        teamId: teamB.id,
      })
      .expect(201);
    expect(proofResponse.body.data.url).toBe('https://cdn.test/loser-proof.png');

    const disputeResponse = await agent
      .post(`/api/v1/matches/${match.id}/disputes`)
      .set('Authorization', bearer(teamOwnerB.accessToken))
      .send({ reason: 'lag spike', evidence: { clip: 'https://cdn.test/clip' } })
      .expect(201);
    expect(disputeResponse.body.data.status).toBe('open');

    const disputesList = await agent
      .get('/api/v1/matches/disputes?status=open')
      .set('Authorization', bearer(admin.accessToken))
      .expect(200);
    expect(disputesList.body.data).toHaveLength(1);

    const resolved = await agent
      .post(`/api/v1/matches/disputes/${disputeResponse.body.data.id}/resolve`)
      .set('Authorization', bearer(admin.accessToken))
      .send({ decision: 'rerun', metadata: { note: 'inconclusive' } })
      .expect(200);
    expect(resolved.body.data.status).toBe('resolved');

    const rerunMatch = await matchRepo.findOne({ 
      where: { id: match.id }, 
      relations: ['provisionalWinnerTeam'] 
    });
    expect(rerunMatch?.status).toBe('scheduled');
    expect(rerunMatch?.startedAt).toBeNull();
    expect(rerunMatch?.provisionalWinnerTeam).toBeNull();
  });

  it('supports organizer forfeits and admin reverts to re-open matches', async () => {
    const admin = await loginAsRole('admin');
    const organizer = await loginAsRole('organizer');
    const teamOwnerA = await loginAsRole('player');
    const teamOwnerB = await loginAsRole('player');

    const teamA = await createTeam(teamOwnerA, 'echo');
    const teamB = await createTeam(teamOwnerB, 'foxtrot');
    const tournament = await createTournament(organizer);
    const match = await createMatch(organizer, tournament.id, [teamA.id, teamB.id]);

    await agent
      .post(`/api/v1/matches/${match.id}/start`)
      .set('Authorization', bearer(organizer.accessToken))
      .expect(200);

    await agent
      .post(`/api/v1/matches/${match.id}/forfeit`)
      .set('Authorization', bearer(organizer.accessToken))
      .send({ forfeitingTeamId: teamB.id, reason: 'no-show' })
      .expect(200);

    let forfeitedMatch = await matchRepo.findOne({
      where: { id: match.id },
      relations: ['forfeitedByTeam', 'provisionalWinnerTeam'],
    });
    expect(forfeitedMatch?.status).toBe('ended');
    expect(forfeitedMatch?.forfeited).toBe(true);
    expect(forfeitedMatch?.forfeitedByTeam?.id).toBe(teamB.id);
    expect(forfeitedMatch?.provisionalWinnerTeam?.id).toBe(teamA.id);

    await agent
      .post(`/api/v1/matches/${match.id}/revert`)
      .set('Authorization', bearer(admin.accessToken))
      .send({ reason: 'manual review' })
      .expect(200);

    forfeitedMatch = await matchRepo.findOne({ where: { id: match.id } });
    expect(forfeitedMatch?.status).toBe('scheduled');
    expect(forfeitedMatch?.forfeited).toBe(false);
    expect(forfeitedMatch?.startedAt).toBeNull();
    expect(forfeitedMatch?.endedAt).toBeNull();
  });
});
