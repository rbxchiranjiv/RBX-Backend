import { Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { MatchEntity } from './match.entity';
import { TeamEntity } from './team.entity';
import { UserEntity } from './user.entity';

export type MatchDisputeStatus = 'open' | 'resolving' | 'resolved';

@Entity({ name: 'match_disputes' })
export class MatchDisputeEntity extends BaseEntity {
  @Column({ type: 'enum', enum: ['open', 'resolving', 'resolved'], default: 'open' })
  status!: MatchDisputeStatus;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'jsonb', nullable: true })
  evidence?: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  resolution?: Record<string, unknown> | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt?: Date | null;

  @ManyToOne(() => MatchEntity, match => match.disputes, { nullable: false, onDelete: 'CASCADE' })
  match!: MatchEntity;

  @ManyToOne(() => TeamEntity, team => team.matchDisputes, { nullable: true, onDelete: 'SET NULL' })
  complainantTeam?: TeamEntity | null;

  @ManyToOne(() => UserEntity, user => user.matchDisputesFiled, { nullable: false, onDelete: 'CASCADE' })
  complainantUser!: UserEntity;

  @ManyToOne(() => UserEntity, user => user.matchDisputesResolved, { nullable: true, onDelete: 'SET NULL' })
  resolvedBy?: UserEntity | null;
}
