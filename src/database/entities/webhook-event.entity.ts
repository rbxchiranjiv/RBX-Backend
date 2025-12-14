import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity({ name: 'webhook_events' })
@Unique(['gateway', 'eventId'])
export class WebhookEventEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 50 })
  gateway!: string;

  @Column({ type: 'varchar', length: 255 })
  eventId!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ type: 'boolean', default: false })
  processed!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt?: Date | null;
}
