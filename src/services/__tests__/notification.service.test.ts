import { DataSource, Repository } from 'typeorm';
import { NotificationService } from '../notification.service';
import { createTestDataSource, destroyTestDataSource } from '../test-utils';
import { MatchEntity, NotificationEntity, TournamentEntity, UserEntity, UserRole } from '../../database/entities';
import { NotFoundError, ValidationError } from '../errors';

describe('NotificationService', () => {
  let dataSource: DataSource;
  let service: NotificationService;
  let notificationRepo: Repository<NotificationEntity>;
  let userRepo: Repository<UserEntity>;
  let tournamentRepo: Repository<TournamentEntity>;
  let matchRepo: Repository<MatchEntity>;
  let user: UserEntity;
  let tournament: TournamentEntity;
  let match: MatchEntity;

  beforeEach(async () => {
    dataSource = await createTestDataSource();
    notificationRepo = dataSource.getRepository(NotificationEntity);
    userRepo = dataSource.getRepository(UserEntity);
    tournamentRepo = dataSource.getRepository(TournamentEntity);
    matchRepo = dataSource.getRepository(MatchEntity);
    service = new NotificationService(notificationRepo, userRepo, tournamentRepo, matchRepo);

    user = await userRepo.save(
      userRepo.create({
        displayName: 'Nova',
        phoneNumber: '9999999999',
        role: UserRole.PLAYER,
      }),
    );

    tournament = await tournamentRepo.save(
      tournamentRepo.create({
        name: 'Test Cup',
        slug: 'test-cup',
        mode: 'BR',
        status: 'draft',
        entryFee: 0,
        creationFee: 50,
        prizePool: 0,
        maxTeams: 13,
        organizer: user,
      }),
    );

    match = await matchRepo.save(
      matchRepo.create({
        tournament,
        code: 'MATCH-1',
        mode: 'BR',
        status: 'scheduled',
        roundNumber: 1,
        reshuffleCount: 0,
        scheduledAt: new Date(),
      }),
    );
  });

  afterEach(async () => {
    await destroyTestDataSource(dataSource);
  });

  it('queues a notification with default status', async () => {
    const payload = { tournamentName: 'Test Cup' };
    const notification = await service.queue(user.id, 'matchScheduled', 'inApp', payload, {
      tournamentId: tournament.id,
      matchId: match.id,
    });

    expect(notification.status).toBe('queued');
    expect(notification.payload).toEqual(payload);
    expect(notification.tournament?.id).toBe(tournament.id);
    expect(notification.match?.id).toBe(match.id);
  });

  it('throws when queueing for an unknown user', async () => {
    await expect(
      service.queue('unknown', 'matchScheduled', 'inApp', { tournamentName: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('updates notification payload with validation', async () => {
    const notification = await service.queue(user.id, 'matchStart', 'sms', { matchCode: 'A1' });
    const updated = await service.update(notification.id, {
      templateKey: 'matchReminder',
      payload: { minutes: 5 },
    });

    expect(updated.templateKey).toBe('matchReminder');
    expect(updated.payload).toEqual({ minutes: 5 });
  });

  it('marks notification through sent -> delivered -> read lifecycle', async () => {
    const notification = await service.queue(user.id, 'matchStart', 'sms', { matchCode: 'B1' });

    const sent = await service.markSent(notification.id);
    expect(sent.status).toBe('sent');
    expect(sent.sentAt).toBeInstanceOf(Date);

    const delivered = await service.markDelivered(notification.id);
    expect(delivered.status).toBe('delivered');
    expect(delivered.deliveredAt).toBeInstanceOf(Date);

    const read = await service.markRead(notification.id);
    expect(read.status).toBe('read');
    expect(read.readAt).toBeInstanceOf(Date);
  });

  it('prevents invalid status transitions', async () => {
    const notification = await service.queue(user.id, 'matchStart', 'sms', { matchCode: 'C1' });
    await expect(service.markDelivered(notification.id)).rejects.toBeInstanceOf(ValidationError);
  });

  it('lists notifications by user with pagination', async () => {
    await service.queue(user.id, 'reminder', 'inApp', { n: 1 });
    await service.queue(user.id, 'reminder', 'inApp', { n: 2 });

    const result = await service.listByUser(user.id, { page: 1, limit: 1, sort: { createdAt: 'ASC' } });
    expect(result.total).toBe(2);
    expect(result.data).toHaveLength(1);
  });

  it('deletes notifications', async () => {
    const notification = await service.queue(user.id, 'matchStart', 'sms', { matchCode: 'D1' });
    await service.delete(notification.id);
    await expect(service.findById(notification.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
