import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRefreshTokensTable1732238400000 implements MigrationInterface {
  private readonly tableName = 'refresh_tokens';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tokenId" varchar(40) NOT NULL UNIQUE,
        "tokenHash" varchar(128) NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        revoked boolean NOT NULL DEFAULT false,
        "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ${this.tableName};`);
  }
}
