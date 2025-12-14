import { Column, Entity, JoinTable, ManyToMany, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { UserEntity } from './user.entity';
import { RegistrationEntity } from './registration.entity';
import { TournamentEntity } from './tournament.entity';
import { MatchEntity } from './match.entity';
import { MatchProofEntity } from './match-proof.entity';
import { MatchDisputeEntity } from './match-dispute.entity';

@Entity({ name: 'teams' })
export class TeamEntity extends BaseEntity {
  @Column({ length: 80, unique: true })
  name!: string;

  @Column({ length: 16, unique: true })
  slug!: string;

  @Column({ length: 8 })
  region!: string;

  @Column({ default: false })
  verified!: boolean;

  @ManyToOne(() => UserEntity, (user: UserEntity) => user.teamsOwned, { nullable: false })
  owner!: UserEntity;

  @ManyToMany(() => UserEntity, (user: UserEntity) => user.teamMemberships, { cascade: true })
  @JoinTable({
    name: 'team_members',
    joinColumn: { name: 'team_id' },
    inverseJoinColumn: { name: 'user_id' },
  })
  members!: UserEntity[];

  @OneToMany(() => RegistrationEntity, (registration: RegistrationEntity) => registration.team)
  registrations!: RegistrationEntity[];

  @ManyToMany(() => TournamentEntity, (tournament: TournamentEntity) => tournament.invitedTeams)
  invitedTo!: TournamentEntity[];

  @ManyToMany(() => MatchEntity, (match: MatchEntity) => match.participants)
  matches!: MatchEntity[];

  @OneToMany(() => MatchProofEntity, proof => proof.team)
  matchProofs!: MatchProofEntity[];

  @OneToMany(() => MatchDisputeEntity, dispute => dispute.complainantTeam)
  matchDisputes!: MatchDisputeEntity[];
}
