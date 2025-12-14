import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnhanceUserEntity1766000000002 implements MigrationInterface {
  name = 'EnhanceUserEntity1766000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "user_status_enum" AS ENUM ('active', 'suspended', 'deleted')`,
    );

    await queryRunner.query(
      `UPDATE "users" SET "email" = concat('user-', encode(gen_random_bytes(6), 'hex'), '@rbx.local') WHERE "email" IS NULL`,
    );
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL`);

    await queryRunner.query(
      `ALTER TABLE "users" ADD "passwordHash" character varying(255) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP DEFAULT`);

    await queryRunner.query(
      `ALTER TABLE "users" ADD "passwordResetToken" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "passwordResetExpiresAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "timezone" character varying(128)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "avatarUrl" character varying(255)`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "isEmailVerified" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "isPhoneVerified" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "marketingOptIn" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "users" ADD "lastLoginAt" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "status" "user_status_enum" NOT NULL DEFAULT 'active'`,
    );
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "isOrganizerVerified" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "preferences" jsonb NOT NULL DEFAULT '{}'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "metadata"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "preferences"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isOrganizerVerified"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "status"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "lastLoginAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "marketingOptIn"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isPhoneVerified"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isEmailVerified"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "avatarUrl"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "timezone"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "passwordResetExpiresAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "passwordResetToken"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "passwordHash"`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL`);
    await queryRunner.query(`DROP TYPE "user_status_enum"`);
  }
}
