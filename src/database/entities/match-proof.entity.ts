import { Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { MatchEntity } from './match.entity';
import { UserEntity } from './user.entity';
import { TeamEntity } from './team.entity';

@Entity({ name: 'match_proofs' })
export class MatchProofEntity extends BaseEntity {
  @Column({ length: 2048 })
  url!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @ManyToOne(() => MatchEntity, match => match.proofs, { nullable: false, onDelete: 'CASCADE' })
  match!: MatchEntity;

  @ManyToOne(() => UserEntity, user => user.matchProofs, { nullable: false, onDelete: 'CASCADE' })
  uploader!: UserEntity;

  @ManyToOne(() => TeamEntity, team => team.matchProofs, { nullable: true, onDelete: 'SET NULL' })
  team?: TeamEntity | null;
}
