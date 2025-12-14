import { MigrationInterface, QueryRunner } from 'typeorm';

export class MatchLifecycle1732408800000 implements MigrationInterface {
  name = 'MatchLifecycle1732408800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "match_dispute_status_enum" AS ENUM ('open', 'resolving', 'resolved')`);

    await queryRunner.query(`
      CREATE TABLE "match_proofs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "url" character varying(2048) NOT NULL,
        "metadata" jsonb,
        "matchId" uuid NOT NULL,
        "uploaderId" uuid NOT NULL,
        "teamId" uuid,
        CONSTRAINT "PK_match_proofs_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_match_proofs_match" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_match_proofs_uploader" FOREIGN KEY ("uploaderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_match_proofs_team" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "match_disputes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "status" "match_dispute_status_enum" NOT NULL DEFAULT 'open',
        "reason" text NOT NULL,
        "evidence" jsonb,
        "resolution" jsonb,
        "resolvedAt" TIMESTAMP WITH TIME ZONE,
        "matchId" uuid NOT NULL,
        "complainantTeamId" uuid,
        "complainantUserId" uuid NOT NULL,
        "resolvedById" uuid,
        CONSTRAINT "PK_match_disputes_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_match_disputes_match" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_match_disputes_team" FOREIGN KEY ("complainantTeamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
        CONSTRAINT "FK_match_disputes_user" FOREIGN KEY ("complainantUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_match_disputes_resolvedBy" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`ALTER TABLE "matches" ADD "qualifierNumber" integer`);
    await queryRunner.query(`ALTER TABLE "matches" ADD "reshuffleIndex" integer`);
    await queryRunner.query(`ALTER TABLE "matches" ADD "provisionalWinnerTeamId" uuid`);
    await queryRunner.query(`ALTER TABLE "matches" ADD "finalWinnerTeamId" uuid`);
    await queryRunner.query(`ALTER TABLE "matches" ADD "forfeited" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "matches" ADD "forfeitedByTeamId" uuid`);
    await queryRunner.query(`ALTER TABLE "matches" ADD "version" integer NOT NULL DEFAULT 1`);

    await queryRunner.query(`
      ALTER TABLE "matches"
      ADD CONSTRAINT "FK_matches_provisional_winner" FOREIGN KEY ("provisionalWinnerTeamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "matches"
      ADD CONSTRAINT "FK_matches_final_winner" FOREIGN KEY ("finalWinnerTeamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "matches"
      ADD CONSTRAINT "FK_matches_forfeit_team" FOREIGN KEY ("forfeitedByTeamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "matches" DROP CONSTRAINT "FK_matches_forfeit_team"`);
    await queryRunner.query(`ALTER TABLE "matches" DROP CONSTRAINT "FK_matches_final_winner"`);
    await queryRunner.query(`ALTER TABLE "matches" DROP CONSTRAINT "FK_matches_provisional_winner"`);

    await queryRunner.query(`ALTER TABLE "matches" DROP COLUMN "version"`);
    await queryRunner.query(`ALTER TABLE "matches" DROP COLUMN "forfeitedByTeamId"`);
    await queryRunner.query(`ALTER TABLE "matches" DROP COLUMN "forfeited"`);
    await queryRunner.query(`ALTER TABLE "matches" DROP COLUMN "finalWinnerTeamId"`);
    await queryRunner.query(`ALTER TABLE "matches" DROP COLUMN "provisionalWinnerTeamId"`);
    await queryRunner.query(`ALTER TABLE "matches" DROP COLUMN "reshuffleIndex"`);
    await queryRunner.query(`ALTER TABLE "matches" DROP COLUMN "qualifierNumber"`);

    await queryRunner.query(`DROP TABLE "match_disputes"`);
    await queryRunner.query(`DROP TABLE "match_proofs"`);
    await queryRunner.query(`DROP TYPE "match_dispute_status_enum"`);
  }
}
