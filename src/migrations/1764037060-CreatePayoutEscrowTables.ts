import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class CreatePayoutEscrowTables1764037060 implements MigrationInterface {
  name = 'CreatePayoutEscrowTables1764037060';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create escrow_accounts table
    await queryRunner.createTable(
      new Table({
        name: 'escrow_accounts',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'owner_user_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'balance_cents',
            type: 'bigint',
            default: 0,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '3',
            default: "'USD'",
          },
          {
            name: 'locked_cents',
            type: 'bigint',
            default: 0,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['owner_user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
        indices: [
          {
            name: 'IDX_escrow_accounts_owner_user_id',
            columnNames: ['owner_user_id'],
          },
        ],
      }),
      true,
    );

    // Create ledger_entries table
    await queryRunner.createTable(
      new Table({
        name: 'ledger_entries',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'escrow_account_id',
            type: 'uuid',
          },
          {
            name: 'kind',
            type: 'varchar',
            length: '20',
          },
          {
            name: 'amount_cents',
            type: 'bigint',
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '3',
            default: "'USD'",
          },
          {
            name: 'related_payment_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'related_match_id',
            type: 'uuid',
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
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['escrow_account_id'],
            referencedTableName: 'escrow_accounts',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['related_payment_id'],
            referencedTableName: 'payment_records',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
          {
            columnNames: ['related_match_id'],
            referencedTableName: 'matches',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
        indices: [
          {
            name: 'IDX_ledger_entries_escrow_account_id',
            columnNames: ['escrow_account_id'],
          },
          {
            name: 'IDX_ledger_entries_kind',
            columnNames: ['kind'],
          },
          {
            name: 'IDX_ledger_entries_related_payment_id',
            columnNames: ['related_payment_id'],
          },
        ],
      }),
      true,
    );

    // Create webhook_events table
    await queryRunner.createTable(
      new Table({
        name: 'webhook_events',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'gateway',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'event_id',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'payload',
            type: 'jsonb',
          },
          {
            name: 'processed',
            type: 'boolean',
            default: false,
          },
          {
            name: 'processed_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
        indices: [
          {
            name: 'IDX_webhook_events_gateway_event_id',
            columnNames: ['gateway', 'event_id'],
            isUnique: true,
          },
          {
            name: 'IDX_webhook_events_processed',
            columnNames: ['processed'],
          },
        ],
      }),
      true,
    );

    // Create payout_batches table
    await queryRunner.createTable(
      new Table({
        name: 'payout_batches',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'processing', 'sent', 'failed'],
            default: "'pending'",
          },
          {
            name: 'total_amount_cents',
            type: 'bigint',
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '3',
            default: "'USD'",
          },
          {
            name: 'created_by_user',
            type: 'uuid',
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['created_by_user'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        indices: [
          {
            name: 'IDX_payout_batches_status',
            columnNames: ['status'],
          },
          {
            name: 'IDX_payout_batches_created_by_user',
            columnNames: ['created_by_user'],
          },
        ],
      }),
      true,
    );

    // Create payout_transactions table
    await queryRunner.createTable(
      new Table({
        name: 'payout_transactions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'batch_id',
            type: 'uuid',
          },
          {
            name: 'to_account_identifier',
            type: 'text',
          },
          {
            name: 'amount_cents',
            type: 'bigint',
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '3',
            default: "'USD'",
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'processing', 'sent', 'failed'],
            default: "'pending'",
          },
          {
            name: 'gateway_reference',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'failure_reason',
            type: 'text',
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
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['batch_id'],
            referencedTableName: 'payout_batches',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        indices: [
          {
            name: 'IDX_payout_transactions_batch_id',
            columnNames: ['batch_id'],
          },
          {
            name: 'IDX_payout_transactions_status',
            columnNames: ['status'],
          },
          {
            name: 'IDX_payout_transactions_gateway_reference',
            columnNames: ['gateway_reference'],
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('payout_transactions');
    await queryRunner.dropTable('payout_batches');
    await queryRunner.dropTable('webhook_events');
    await queryRunner.dropTable('ledger_entries');
    await queryRunner.dropTable('escrow_accounts');
  }
}
