import { Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { TournamentEntity } from './tournament.entity';
import { MatchEntity } from './match.entity';

export type NotificationChannel = 'fcm' | 'inApp' | 'sms' | 'email';
export type NotificationStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'read';

@Entity({ name: 'notifications' })
export class NotificationEntity extends BaseEntity {
  @Column({ length: 80 })
  templateKey!: string;

  @Column({ type: 'enum', enum: ['fcm', 'inApp', 'sms', 'email'], default: 'inApp' })
  channel!: NotificationChannel;

  @Column({ type: 'enum', enum: ['queued', 'sent', 'delivered', 'failed', 'read'], default: 'queued' })
  status!: NotificationStatus;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  deliveredAt?: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  readAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string | null;

  @ManyToOne(() => UserEntity, (user: UserEntity) => user.notifications, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  user!: UserEntity;

  @ManyToOne(() => TournamentEntity, (tournament: TournamentEntity) => tournament.notifications, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  tournament?: TournamentEntity | null;

  @ManyToOne(() => MatchEntity, (match: MatchEntity) => match.notifications, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  match?: MatchEntity | null;
}
