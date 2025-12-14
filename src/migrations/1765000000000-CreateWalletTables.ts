import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class CreateWalletTables1765000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create wallets table
    await queryRunner.createTable(
      new Table({
        name: 'wallets',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '3',
            isNullable: false,
            default: "'USD'",
          },
          {
            name: 'balance',
            type: 'decimal',
            precision: 15,
            scale: 2,
            isNullable: false,
            default: 0,
          },
          {
            name: 'locked_balance',
            type: 'decimal',
            precision: 15,
            scale: 2,
            isNullable: false,
            default: 0,
          },
          {
            name: 'available_balance',
            type: 'decimal',
            precision: 15,
            scale: 2,
            isNullable: false,
            default: 0,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            isNullable: false,
            default: "'active'",
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
            name: 'IDX_wallet_user_id',
            columnNames: ['user_id'],
          },
          {
            name: 'IDX_wallet_user_currency',
            columnNames: ['user_id', 'currency'],
            isUnique: true,
          },
          {
            name: 'IDX_wallet_status',
            columnNames: ['status'],
          },
        ],
      }),
      true
    );

    // Create foreign key constraint
    await queryRunner.query(`
      ALTER TABLE wallets 
      ADD CONSTRAINT FK_wallet_user_id 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    `);

    // Create wallet_transactions table
    await queryRunner.createTable(
      new Table({
        name: 'wallet_transactions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'wallet_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 15,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'balance_before',
            type: 'decimal',
            precision: 15,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'balance_after',
            type: 'decimal',
            precision: 15,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'reference_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'reference_type',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            isNullable: false,
            default: "'completed'",
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
            name: 'IDX_wallet_transaction_wallet_id',
            columnNames: ['wallet_id'],
          },
          {
            name: 'IDX_wallet_transaction_type',
            columnNames: ['type'],
          },
          {
            name: 'IDX_wallet_transaction_reference',
            columnNames: ['reference_id', 'reference_type'],
          },
          {
            name: 'IDX_wallet_transaction_created_at',
            columnNames: ['created_at'],
          },
        ],
      }),
      true
    );

    // Create foreign key constraint
    await queryRunner.query(`
      ALTER TABLE wallet_transactions 
      ADD CONSTRAINT FK_wallet_transaction_wallet_id 
      FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('wallet_transactions');
    await queryRunner.dropTable('wallets');
  }
}
