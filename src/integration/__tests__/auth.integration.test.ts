import request from 'supertest';
import type { DataSource, Repository } from 'typeorm';
import { createApp } from '../../app';
import { createTestDataSource, destroyTestDataSource } from '../../services/test-utils';
import { UserEntity } from '../../database/entities/user.entity';

describe('Auth & RBAC integration', () => {
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

  const loginAsRole = async (phoneNumber: string, role: UserEntity['role']) => {
    let auth = await loginUser(phoneNumber);
    if (auth.user.role !== role) {
      await userRepo.update(auth.user.id, { role });
      auth = await loginUser(phoneNumber);
    }
    return auth;
  };

  const createTeamWithOwner = async (
    ownerAuth: Awaited<ReturnType<typeof loginUser>>,
    slug: string,
  ) => {
    const memberPhones = ['9400000001', '9400000002', '9400000003', '9400000004'].map(
      (base, idx) => `${base}${idx}`,
    );
    const members = await Promise.all(memberPhones.map(phone => loginAsRole(phone, 'player')));
    const response = await agent
      .post('/api/v1/teams')
      .set('Authorization', bearer(ownerAuth.accessToken))
      .send({
        name: `Team-${slug}`,
        slug,
        region: 'IN',
        ownerId: ownerAuth.user.id,
        memberIds: members.map(member => member.user.id),
      });
    if (response.status !== 201) {
      // eslint-disable-next-line no-console
      console.error('Team creation failed', response.status, response.body);
      throw new Error(`Team creation failed with status ${response.status}`);
    }
    return response.body.data;
  };

  it('allows login and accessing protected routes with access token', async () => {
    const auth = await loginAsRole('9300000010', 'player');
    const response = await agent
      .get(`/api/v1/users/${auth.user.id}`)
      .set('Authorization', bearer(auth.accessToken))
      .expect(200);
    expect(response.body.data.id).toBe(auth.user.id);
  });

  it('rotates refresh tokens and invalidates old token on refresh', async () => {
    const auth = await loginAsRole('9300000020', 'player');
    const refreshResponse = await agent.post('/api/v1/auth/refresh').send({ refreshToken: auth.refreshToken }).expect(200);
    const refreshed = refreshResponse.body.data as { refreshToken: string; accessToken: string };
    expect(refreshed.refreshToken).not.toBe(auth.refreshToken);

    await agent.post('/api/v1/auth/refresh').send({ refreshToken: auth.refreshToken }).expect(400);
    await agent
      .get(`/api/v1/users/${auth.user.id}`)
      .set('Authorization', bearer(refreshed.accessToken))
      .expect(200);
  });

  it('revokes refresh token on logout', async () => {
    const auth = await loginAsRole('9300000030', 'player');
    await agent.post('/api/v1/auth/logout').send({ refreshToken: auth.refreshToken }).expect(200);
    await agent.post('/api/v1/auth/refresh').send({ refreshToken: auth.refreshToken }).expect(400);
  });

  it('enforces organizer RBAC on tournament creation', async () => {
    const player = await loginAsRole('9300000040', 'player');
    await agent
      .post('/api/v1/tournaments')
      .set('Authorization', bearer(player.accessToken))
      .send({
        name: 'Player Attempt',
        slug: `player-attempt-${Date.now()}`,
        mode: 'BR',
        organizerId: player.user.id,
        maxTeams: 16,
      })
      .expect(403);

    const organizer = await loginAsRole('9300000050', 'organizer');
    await agent
      .post('/api/v1/tournaments')
      .set('Authorization', bearer(organizer.accessToken))
      .send({
        name: 'Organizer Cup',
        slug: `organizer-cup-${Date.now()}`,
        mode: 'BR',
        organizerId: organizer.user.id,
        maxTeams: 32,
      })
      .expect(201);
  });

  it('enforces ownership checks when updating teams', async () => {
    const owner = await loginAsRole('9300000060', 'player');
    const slugSeed = Date.now().toString().slice(-6);
    const teamSlug = `ownertm${slugSeed}`.slice(0, 16);
    const team = await createTeamWithOwner(owner, teamSlug);

    await agent
      .patch(`/api/v1/teams/${team.id}`)
      .set('Authorization', bearer(owner.accessToken))
      .send({ region: 'US' })
      .expect(200);

    const intruder = await loginAsRole('9300000070', 'player');
    await agent
      .patch(`/api/v1/teams/${team.id}`)
      .set('Authorization', bearer(intruder.accessToken))
      .send({ region: 'EU' })
      .expect(403);
  });
});
