import request from 'supertest';
import type { DataSource, Repository } from 'typeorm';
import { createApp } from '../../app';
import { createTestDataSource, destroyTestDataSource } from '../../services/test-utils';
import { UserEntity } from '../../database/entities/user.entity';

const ISO_DATE = '2024-01-01T00:00:00.000Z';

describe('RBx API integration', () => {
  let dataSource: DataSource;
  let agent: request.SuperTest<request.Test>;
  let userRepo: Repository<UserEntity>;

  beforeEach(async () => {
    dataSource = await createTestDataSource();
    agent = request(createApp(dataSource));
    userRepo = dataSource.getRepository(UserEntity);
  });

  afterEach(async () => {
    await destroyTestDataSource(dataSource);
  });

  const bearer = (token: string) => `Bearer ${token}`;

  const loginUser = async (phoneNumber: string) => {
    const response = await agent.post('/api/v1/auth/login').send({ phoneNumber }).expect(200);
    return response.body.data as {
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
      user: UserEntity;
    };
  };

  const createUserWithRole = async (phoneNumber: string, role: UserEntity['role']) => {
    let auth = await loginUser(phoneNumber);
    if (auth.user.role !== role) {
      await userRepo.update(auth.user.id, { role });
      auth = await loginUser(phoneNumber);
    }
    return auth;
  };

  it('runs full happy-path flow', async () => {
    const admin = await createUserWithRole('9000000001', 'admin');
    const organizer = await createUserWithRole('9000000002', 'organizer');
    const memberUsers = await Promise.all(
      ['9000000003', '9000000004', '9000000005', '9000000006'].map(phone => createUserWithRole(phone, 'player')),
    );

    const teamResponse = await agent
      .post('/api/v1/teams')
      .set('Authorization', bearer(organizer.accessToken))
      .send({
        name: 'Nova Squad',
        slug: 'nova-squad-1',
        region: 'IN',
        ownerId: organizer.user.id,
        memberIds: memberUsers.map(member => member.user.id),
      })
      .expect(201);
    const team = teamResponse.body.data;

    const tournamentResponse = await agent
      .post('/api/v1/tournaments')
      .set('Authorization', bearer(organizer.accessToken))
      .send({
        name: 'Integration Cup',
        slug: `integration-cup-${Date.now()}`,
        mode: 'BR',
        organizerId: organizer.user.id,
        entryFee: 0,
        creationFee: 50,
        prizePool: 1000,
        maxTeams: 64,
        invitesEnabled: true,
      })
      .expect(201);
    const tournament = tournamentResponse.body.data;

    await agent
      .post(`/api/v1/tournaments/${tournament.id}/publish`)
      .set('Authorization', bearer(organizer.accessToken))
      .expect(200);

    await agent
      .post(`/api/v1/tournaments/${tournament.id}/invites`)
      .set('Authorization', bearer(organizer.accessToken))
      .send({ teamId: team.id })
      .expect(200);

    const registrationResponse = await agent
      .post('/api/v1/registrations')
      .set('Authorization', bearer(organizer.accessToken))
      .send({ tournamentId: tournament.id, teamId: team.id, invitedSlot: true })
      .expect(201);
    const registration = registrationResponse.body.data;

    await agent
      .post(`/api/v1/registrations/${registration.id}/confirm`)
      .set('Authorization', bearer(organizer.accessToken))
      .expect(200);

    const paymentResponse = await agent
      .post('/api/v1/payment-records')
      .set('Authorization', bearer(admin.accessToken))
      .send({
        userId: organizer.user.id,
        direction: 'credit',
        amount: 500,
        gateway: 'paytm',
        referenceId: `ref-${Date.now()}`,
        tournamentId: tournament.id,
      })
      .expect(201);
    const paymentRecord = paymentResponse.body.data;

    await agent
      .post(`/api/v1/registrations/${registration.id}/mark-paid`)
      .set('Authorization', bearer(organizer.accessToken))
      .send({ paymentRecordId: paymentRecord.id })
      .expect(200);

    const matchResponse = await agent
      .post('/api/v1/matches')
      .set('Authorization', bearer(organizer.accessToken))
      .send({
        tournamentId: tournament.id,
        code: `MATCH-${Date.now()}`,
        mode: 'BR',
        scheduledAt: ISO_DATE,
        participants: [team.id],
      })
      .expect(201);
    const match = matchResponse.body.data;

    const notificationResponse = await agent
      .post('/api/v1/notifications/queue')
      .set('Authorization', bearer(admin.accessToken))
      .send({
        userId: organizer.user.id,
        templateKey: 'matchScheduled',
        channel: 'inApp',
        payload: { tournament: tournament.name, match: match.code },
        tournamentId: tournament.id,
        matchId: match.id,
      })
      .expect(201);
    expect(notificationResponse.body.data.status).toBe('queued');

    const listResponse = await agent
      .get(`/api/v1/notifications?userId=${organizer.user.id}`)
      .set('Authorization', bearer(organizer.accessToken))
      .expect(200);
    expect(listResponse.body.data.total).toBeGreaterThanOrEqual(1);
    expect(listResponse.body.data.data[0].templateKey).toBe('matchScheduled');
  });
});
