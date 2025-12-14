import { Column, Entity, ManyToOne, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';

@Entity({ name: 'refresh_tokens' })
export class RefreshTokenEntity extends BaseEntity {
  @Column({ length: 40 })
  @Index({ unique: true })
  tokenId!: string;

  @Column({ length: 128 })
  tokenHash!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'boolean', default: false })
  revoked!: boolean;

  @ManyToOne(() => UserEntity, user => user.refreshTokens, { onDelete: 'CASCADE' })
  user!: UserEntity;
}
