import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class CreateEscrowHoldTables1765000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'escrow_holds',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'escrow_account_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'tournament_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 15,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'hold_type',
            type: 'varchar',
            length: '50',
            isNullable: false,
            default: "'tournament_prize'",
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            isNullable: false,
            default: "'active'",
          },
          {
            name: 'released_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'expires_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            isNullable: false,
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            isNullable: false,
            default: 'now()',
          },
        ],
        indices: [
          {
            name: 'IDX_escrow_hold_escrow_account',
            columnNames: ['escrow_account_id'],
          },
          {
            name: 'IDX_escrow_hold_tournament',
            columnNames: ['tournament_id'],
          },
          {
            name: 'IDX_escrow_hold_status',
            columnNames: ['status'],
          },
        ],
      }),
      true
    );

    // Create foreign key constraints
    await queryRunner.query(`
      ALTER TABLE escrow_holds 
      ADD CONSTRAINT FK_escrow_hold_escrow_account_id 
      FOREIGN KEY (escrow_account_id) REFERENCES escrow_accounts(id) ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE escrow_holds 
      ADD CONSTRAINT FK_escrow_hold_tournament_id 
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('escrow_holds');
  }
}
