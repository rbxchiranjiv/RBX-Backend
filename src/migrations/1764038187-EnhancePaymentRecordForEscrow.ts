import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnhancePaymentRecordForEscrow1764038187 implements MigrationInterface {
  name = 'EnhancePaymentRecordForEscrow1764038187';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE payment_records 
      ADD COLUMN settlement_status VARCHAR(20) CHECK(settlement_status IN ('pending', 'settled', 'failed', 'reversed')),
      ADD COLUMN gateway_response JSONB,
      ADD COLUMN gateway_event_id VARCHAR(255),
      ADD COLUMN escrow_hold BOOLEAN DEFAULT FALSE
    `);

    // Create index for gateway_event_id for faster webhook processing
    await queryRunner.query(`
      CREATE INDEX IDX_payment_records_gateway_event_id 
      ON payment_records(gateway_event_id) 
      WHERE gateway_event_id IS NOT NULL
    `);

    // Create index for settlement_status
    await queryRunner.query(`
      CREATE INDEX IDX_payment_records_settlement_status 
      ON payment_records(settlement_status) 
      WHERE settlement_status IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_payment_records_gateway_event_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_payment_records_settlement_status`);
    
    await queryRunner.query(`
      ALTER TABLE payment_records 
      DROP COLUMN IF EXISTS settlement_status,
      DROP COLUMN IF EXISTS gateway_response,
      DROP COLUMN IF EXISTS gateway_event_id,
      DROP COLUMN IF EXISTS escrow_hold
    `);
  }
}
