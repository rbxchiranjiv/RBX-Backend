import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialMigration1732140000000 implements MigrationInterface {
  name = 'InitialMigration1732140000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`CREATE TYPE "user_role_enum" AS ENUM ('player', 'organizer', 'admin')`);
    await queryRunner.query(`CREATE TYPE "tournament_mode_enum" AS ENUM ('BR', 'CS')`);
    await queryRunner.query(`CREATE TYPE "tournament_status_enum" AS ENUM ('draft', 'published', 'ongoing', 'completed', 'cancelled')`);
    await queryRunner.query(`CREATE TYPE "registration_status_enum" AS ENUM ('pending', 'confirmed', 'waitlisted', 'cancelled')`);
    await queryRunner.query(`CREATE TYPE "registration_payment_status_enum" AS ENUM ('pending', 'paid', 'refunded')`);
    await queryRunner.query(`CREATE TYPE "match_status_enum" AS ENUM ('scheduled', 'ongoing', 'ended', 'cancelled')`);
    await queryRunner.query(`CREATE TYPE "payment_direction_enum" AS ENUM ('credit', 'debit')`);
    await queryRunner.query(`CREATE TYPE "payment_status_enum" AS ENUM ('pending', 'success', 'failed', 'refunded')`);
    await queryRunner.query(`CREATE TYPE "notification_channel_enum" AS ENUM ('fcm', 'inApp', 'sms', 'email')`);
    await queryRunner.query(`CREATE TYPE "notification_status_enum" AS ENUM ('queued', 'sent', 'delivered', 'failed', 'read')`);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "displayName" character varying(80) NOT NULL,
        "phoneNumber" character varying(20) NOT NULL,
        "email" character varying(120),
        "role" "user_role_enum" NOT NULL DEFAULT 'player',
        "countryCode" character varying(8),
        "deviceId" character varying(120),
        "kycVerified" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_phone" UNIQUE ("phoneNumber"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "teams" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "name" character varying(80) NOT NULL,
        "slug" character varying(16) NOT NULL,
        "region" character varying(8) NOT NULL,
        "verified" boolean NOT NULL DEFAULT false,
        "ownerId" uuid NOT NULL,
        CONSTRAINT "PK_teams_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_teams_name" UNIQUE ("name"),
        CONSTRAINT "UQ_teams_slug" UNIQUE ("slug"),
        CONSTRAINT "FK_teams_owner" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "tournaments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "name" character varying(120) NOT NULL,
        "slug" character varying(60) NOT NULL,
        "mode" "tournament_mode_enum" NOT NULL,
        "status" "tournament_status_enum" NOT NULL DEFAULT 'draft',
        "entryFee" integer NOT NULL DEFAULT 0,
        "creationFee" integer NOT NULL DEFAULT 0,
        "prizePool" integer NOT NULL DEFAULT 0,
        "maxTeams" integer NOT NULL DEFAULT 0,
        "isVersus" boolean NOT NULL DEFAULT false,
        "invitesEnabled" boolean NOT NULL DEFAULT false,
        "registrationOpensAt" TIMESTAMP WITH TIME ZONE,
        "registrationClosesAt" TIMESTAMP WITH TIME ZONE,
        "startsAt" TIMESTAMP WITH TIME ZONE,
        "endsAt" TIMESTAMP WITH TIME ZONE,
        "metadata" jsonb,
        "organizerId" uuid NOT NULL,
        CONSTRAINT "PK_tournaments_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tournaments_slug" UNIQUE ("slug"),
        CONSTRAINT "FK_tournaments_organizer" FOREIGN KEY ("organizerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "registrations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "status" "registration_status_enum" NOT NULL DEFAULT 'pending',
        "paymentStatus" "registration_payment_status_enum" NOT NULL DEFAULT 'pending',
        "amountPaid" integer NOT NULL DEFAULT 0,
        "invitedSlot" boolean NOT NULL DEFAULT false,
        "reshufflesUsed" integer NOT NULL DEFAULT 0,
        "metadata" jsonb,
        "tournamentId" uuid NOT NULL,
        "teamId" uuid NOT NULL,
        CONSTRAINT "PK_registrations_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_registrations_tournament_team" UNIQUE ("tournamentId", "teamId"),
        CONSTRAINT "FK_registrations_tournament" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_registrations_team" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "matches" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "code" character varying(40) NOT NULL,
        "mode" "tournament_mode_enum" NOT NULL,
        "status" "match_status_enum" NOT NULL DEFAULT 'scheduled',
        "roundNumber" integer NOT NULL DEFAULT 1,
        "reshuffleCount" integer NOT NULL DEFAULT 0,
        "scheduledAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "startedAt" TIMESTAMP WITH TIME ZONE,
        "endedAt" TIMESTAMP WITH TIME ZONE,
        "roomId" character varying(40),
        "roomPassword" character varying(40),
        "resultMetadata" jsonb,
        "tournamentId" uuid NOT NULL,
        CONSTRAINT "PK_matches_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_matches_code" UNIQUE ("code"),
        CONSTRAINT "FK_matches_tournament" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "payment_records" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "direction" "payment_direction_enum" NOT NULL,
        "amount" integer NOT NULL,
        "currency" character varying(8) NOT NULL DEFAULT 'INR',
        "gateway" character varying(40) NOT NULL,
        "referenceId" character varying(80) NOT NULL,
        "status" "payment_status_enum" NOT NULL DEFAULT 'pending',
        "escrowHold" boolean NOT NULL DEFAULT false,
        "processedAt" TIMESTAMP WITH TIME ZONE,
        "metadata" jsonb,
        "userId" uuid NOT NULL,
        "tournamentId" uuid,
        "registrationId" uuid,
        CONSTRAINT "PK_payment_records_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_payment_records_reference" UNIQUE ("referenceId"),
        CONSTRAINT "FK_payment_records_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_payment_records_tournament" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
        CONSTRAINT "FK_payment_records_registration" FOREIGN KEY ("registrationId") REFERENCES "registrations"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "templateKey" character varying(80) NOT NULL,
        "channel" "notification_channel_enum" NOT NULL DEFAULT 'inApp',
        "status" "notification_status_enum" NOT NULL DEFAULT 'queued',
        "payload" jsonb NOT NULL,
        "sentAt" TIMESTAMP WITH TIME ZONE,
        "deliveredAt" TIMESTAMP WITH TIME ZONE,
        "readAt" TIMESTAMP WITH TIME ZONE,
        "errorMessage" text,
        "userId" uuid NOT NULL,
        "tournamentId" uuid,
        "matchId" uuid,
        CONSTRAINT "PK_notifications_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notifications_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_notifications_tournament" FOREIGN KEY ("tournamentId") REFERENCES "tournaments"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
        CONSTRAINT "FK_notifications_match" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "team_members" (
        "team_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        CONSTRAINT "PK_team_members" PRIMARY KEY ("team_id", "user_id"),
        CONSTRAINT "FK_team_members_team" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_team_members_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "tournament_invites" (
        "tournament_id" uuid NOT NULL,
        "team_id" uuid NOT NULL,
        CONSTRAINT "PK_tournament_invites" PRIMARY KEY ("tournament_id", "team_id"),
        CONSTRAINT "FK_tournament_invites_tournament" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_tournament_invites_team" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "match_participants" (
        "match_id" uuid NOT NULL,
        "team_id" uuid NOT NULL,
        CONSTRAINT "PK_match_participants" PRIMARY KEY ("match_id", "team_id"),
        CONSTRAINT "FK_match_participants_match" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_match_participants_team" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "match_participants"`);
    await queryRunner.query(`DROP TABLE "tournament_invites"`);
    await queryRunner.query(`DROP TABLE "team_members"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TABLE "payment_records"`);
    await queryRunner.query(`DROP TABLE "matches"`);
    await queryRunner.query(`DROP TABLE "registrations"`);
    await queryRunner.query(`DROP TABLE "tournaments"`);
    await queryRunner.query(`DROP TABLE "teams"`);
    await queryRunner.query(`DROP TABLE "users"`);

    await queryRunner.query(`DROP TYPE "notification_status_enum"`);
    await queryRunner.query(`DROP TYPE "notification_channel_enum"`);
    await queryRunner.query(`DROP TYPE "payment_status_enum"`);
    await queryRunner.query(`DROP TYPE "payment_direction_enum"`);
    await queryRunner.query(`DROP TYPE "match_status_enum"`);
    await queryRunner.query(`DROP TYPE "registration_payment_status_enum"`);
    await queryRunner.query(`DROP TYPE "registration_status_enum"`);
    await queryRunner.query(`DROP TYPE "tournament_status_enum"`);
    await queryRunner.query(`DROP TYPE "tournament_mode_enum"`);
    await queryRunner.query(`DROP TYPE "user_role_enum"`);
  }
}
