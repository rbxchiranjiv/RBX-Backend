import request from 'supertest';
import type { DataSource, Repository } from 'typeorm';
import { createApp } from '../../app';
import { createTestDataSource, destroyTestDataSource } from '../../services/test-utils';
import { UserEntity } from '../../database/entities/user.entity';
import { PaymentRecordEntity } from '../../database/entities/payment-record.entity';

const hourMs = 60 * 60 * 1000;
let phoneSequence = 9500000000;

const nextPhoneNumber = () => (phoneSequence++).toString();
const isoIn = (deltaMs: number) => new Date(Date.now() + deltaMs).toISOString();
const bearer = (token: string) => `Bearer ${token}`;

describe.skip('Registration workflow', () => {
  let dataSource: DataSource;
  let agent: request.SuperTest<request.Test>;
  let userRepo: Repository<UserEntity>;
  let paymentRepo: Repository<PaymentRecordEntity>;

  beforeEach(async () => {
    dataSource = await createTestDataSource();
    agent = request(createApp(dataSource));
    userRepo = dataSource.getRepository(UserEntity);
    paymentRepo = dataSource.getRepository(PaymentRecordEntity);
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

  const loginAsRole = async (phoneNumber: string, role: UserEntity['role']) => {
    let auth = await loginUser(phoneNumber);
    if (auth.user.role !== role) {
      await userRepo.update(auth.user.id, { role });
      auth = await loginUser(phoneNumber);
    }
    return auth;
  };

  const createTeamWithOwner = async (ownerAuth: Awaited<ReturnType<typeof loginUser>>, slugPrefix: string) => {
    const memberPhones = Array.from({ length: 4 }, () => nextPhoneNumber());
    const members = await Promise.all(memberPhones.map(phone => loginAsRole(phone, 'player')));
    const slug = `${slugPrefix}-${Date.now().toString(36)}`.slice(0, 16);
    const response = await agent
      .post('/api/v1/teams')
      .set('Authorization', bearer(ownerAuth.accessToken))
      .send({
        name: `Team-${slug}`,
        slug,
        region: 'IN',
        ownerId: ownerAuth.user.id,
        memberIds: members.map(member => member.user.id),
      })
      .expect(201);
    return response.body.data;
  };

  type TournamentOptions = {
    entryFee?: number;
    invitesEnabled?: boolean;
    registrationOpensAt?: string;
    registrationClosesAt?: string;
    startsAt?: string;
    endsAt?: string;
    maxTeams?: number;
    name?: string;
    slug?: string;
  };

  const createAndPublishTournament = async (
    organizerAuth: Awaited<ReturnType<typeof loginUser>>,
    options: TournamentOptions = {},
  ) => {
    const response = await agent
      .post('/api/v1/tournaments')
      .set('Authorization', bearer(organizerAuth.accessToken))
      .send({
        name: options.name ?? `Tournament-${Date.now()}`,
        slug: options.slug ?? `tour-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        mode: 'BR',
        organizerId: organizerAuth.user.id,
        entryFee: options.entryFee ?? 0,
        creationFee: 50,
        prizePool: 1000,
        maxTeams: options.maxTeams ?? 64,
        invitesEnabled: options.invitesEnabled ?? false,
        registrationOpensAt: options.registrationOpensAt ?? isoIn(-2 * hourMs),
        registrationClosesAt: options.registrationClosesAt ?? isoIn(6 * hourMs),
        startsAt: options.startsAt ?? isoIn(8 * hourMs),
        endsAt: options.endsAt ?? isoIn(16 * hourMs),
      })
      .expect(201);
    const tournament = response.body.data;

    await agent
      .post(`/api/v1/tournaments/${tournament.id}/publish`)
      .set('Authorization', bearer(organizerAuth.accessToken))
      .expect(200);

    return tournament;
  };

  const inviteTeam = async (
    organizerAuth: Awaited<ReturnType<typeof loginUser>>,
    tournamentId: string,
    teamId: string,
  ) => {
    await agent
      .post(`/api/v1/tournaments/${tournamentId}/invites`)
      .set('Authorization', bearer(organizerAuth.accessToken))
      .send({ teamId })
      .expect(200);
  };

  const createPaymentRecord = async (
    adminAuth: Awaited<ReturnType<typeof loginUser>>,
    userId: string,
    tournamentId: string,
    amount: number,
  ) => {
    const response = await agent
      .post('/api/v1/payment-records')
      .set('Authorization', bearer(adminAuth.accessToken))
      .send({
        userId,
        direction: 'debit',
        amount,
        gateway: 'razorpay',
        referenceId: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        status: 'success',
        tournamentId,
      })
      .expect(201);
    return response.body.data.id as string;
  };

  it('allows free registration by the team owner when window is open', async () => {
    const owner = await loginAsRole(nextPhoneNumber(), 'player');
    const team = await createTeamWithOwner(owner, 'free');
    const organizer = await loginAsRole(nextPhoneNumber(), 'organizer');
    const tournament = await createAndPublishTournament(organizer, { entryFee: 0 });

    const response = await agent
      .post('/api/v1/registrations')
      .set('Authorization', bearer(owner.accessToken))
      .send({ tournamentId: tournament.id, teamId: team.id })
      .expect(201);

    const registration = response.body.data;
    expect(registration.paymentStatus).toBe('pending');
    expect(registration.invitedSlot).toBe(false);
  });

  it('requires payment for paid tournaments and links payment records', async () => {
    const owner = await loginAsRole(nextPhoneNumber(), 'player');
    const team = await createTeamWithOwner(owner, 'paid');
    const organizer = await loginAsRole(nextPhoneNumber(), 'organizer');
    const tournament = await createAndPublishTournament(organizer, { entryFee: 500 });
    const admin = await loginAsRole(nextPhoneNumber(), 'admin');
    const paymentRecordId = await createPaymentRecord(admin, owner.user.id, tournament.id, 500);

    const response = await agent
      .post('/api/v1/registrations')
      .set('Authorization', bearer(owner.accessToken))
      .send({ tournamentId: tournament.id, teamId: team.id, paymentRecordId })
      .expect(201);

    const registration = response.body.data;
    expect(registration.paymentStatus).toBe('paid');
    expect(registration.amountPaid).toBe(500);

    const paymentRecord = await paymentRepo.findOne({ where: { id: paymentRecordId }, relations: ['registration'] });
    expect(paymentRecord?.registration?.id).toBe(registration.id);
  });

  it('prevents duplicate registrations for the same team and tournament', async () => {
    const owner = await loginAsRole(nextPhoneNumber(), 'player');
    const team = await createTeamWithOwner(owner, 'dup');
    const organizer = await loginAsRole(nextPhoneNumber(), 'organizer');
    const tournament = await createAndPublishTournament(organizer);

    await agent
      .post('/api/v1/registrations')
      .set('Authorization', bearer(owner.accessToken))
      .send({ tournamentId: tournament.id, teamId: team.id })
      .expect(201);

    await agent
      .post('/api/v1/registrations')
      .set('Authorization', bearer(owner.accessToken))
      .send({ tournamentId: tournament.id, teamId: team.id })
      .expect(400);
  });

  it('rejects registrations outside the configured window', async () => {
    const owner = await loginAsRole(nextPhoneNumber(), 'player');
    const team = await createTeamWithOwner(owner, 'window');
    const organizer = await loginAsRole(nextPhoneNumber(), 'organizer');
    const tournament = await createAndPublishTournament(organizer, {
      registrationOpensAt: isoIn(2 * hourMs),
      registrationClosesAt: isoIn(4 * hourMs),
    });

    await agent
      .post('/api/v1/registrations')
      .set('Authorization', bearer(owner.accessToken))
      .send({ tournamentId: tournament.id, teamId: team.id })
      .expect(400);
  });

  it('allows organizer invited registration without payment and enforces invited slot limit', async () => {
    const organizer = await loginAsRole(nextPhoneNumber(), 'organizer');
    const tournament = await createAndPublishTournament(organizer, { entryFee: 750, invitesEnabled: true });

    const teams = [];
    for (let i = 0; i < 6; i += 1) {
      const owner = await loginAsRole(nextPhoneNumber(), 'player');
      const team = await createTeamWithOwner(owner, `invited${i}`);
      teams.push(team);
      await inviteTeam(organizer, tournament.id, team.id);
    }

    for (let i = 0; i < 5; i += 1) {
      const response = await agent
        .post('/api/v1/registrations/invited')
        .set('Authorization', bearer(organizer.accessToken))
        .send({ tournamentId: tournament.id, teamId: teams[i].id, metadata: { seed: i } })
        .expect(201);
      expect(response.body.data.invitedSlot).toBe(true);
      expect(response.body.data.paymentStatus).toBe('pending');
    }

    await agent
      .post('/api/v1/registrations/invited')
      .set('Authorization', bearer(organizer.accessToken))
      .send({ tournamentId: tournament.id, teamId: teams[5].id })
      .expect(400);
  });

  it('enforces cancellation RBAC and start-time rules', async () => {
    const organizer = await loginAsRole(nextPhoneNumber(), 'organizer');
    const owner = await loginAsRole(nextPhoneNumber(), 'player');
    const intruder = await loginAsRole(nextPhoneNumber(), 'player');
    const team = await createTeamWithOwner(owner, 'cancel');
    const tournament = await createAndPublishTournament(organizer);

    const registrationResponse = await agent
      .post('/api/v1/registrations')
      .set('Authorization', bearer(owner.accessToken))
      .send({ tournamentId: tournament.id, teamId: team.id })
      .expect(201);
    const registrationId = registrationResponse.body.data.id as string;

    await agent
      .post(`/api/v1/registrations/${registrationId}/cancel`)
      .set('Authorization', bearer(intruder.accessToken))
      .expect(403);

    const organizerCancel = await agent
      .post(`/api/v1/registrations/${registrationId}/cancel`)
      .set('Authorization', bearer(organizer.accessToken))
      .expect(200);
    expect(organizerCancel.body.data.status).toBe('cancelled');

    const admin = await loginAsRole(nextPhoneNumber(), 'admin');
    const ownerPaid = await loginAsRole(nextPhoneNumber(), 'player');
    const teamPaid = await createTeamWithOwner(ownerPaid, 'cancelpaid');
    const pastTournament = await createAndPublishTournament(organizer, {
      entryFee: 400,
      registrationOpensAt: isoIn(-4 * hourMs),
      registrationClosesAt: isoIn(2 * hourMs),
      startsAt: isoIn(-1 * hourMs),
    });
    const paymentRecordId = await createPaymentRecord(admin, ownerPaid.user.id, pastTournament.id, 400);

    const paidRegistrationResponse = await agent
      .post('/api/v1/registrations')
      .set('Authorization', bearer(ownerPaid.accessToken))
      .send({ tournamentId: pastTournament.id, teamId: teamPaid.id, paymentRecordId })
      .expect(201);
    const paidRegistrationId = paidRegistrationResponse.body.data.id as string;

    await agent
      .post(`/api/v1/registrations/${paidRegistrationId}/cancel`)
      .set('Authorization', bearer(ownerPaid.accessToken))
      .expect(400);

    const adminCancel = await agent
      .post(`/api/v1/registrations/${paidRegistrationId}/cancel`)
      .set('Authorization', bearer(admin.accessToken))
      .expect(200);
    expect(adminCancel.body.data.paymentStatus).toBe('refunded');

    const paymentRecord = await paymentRepo.findOne({ where: { id: paymentRecordId } });
    expect(paymentRecord?.status).toBe('refunded');
  });
});
