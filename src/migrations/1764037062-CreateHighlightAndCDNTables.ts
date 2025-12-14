import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class CreateHighlightAndCDNTables1764037062 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create highlights table
    await queryRunner.createTable(
      new Table({
        name: 'highlights',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'streamSessionId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'matchId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'tournamentId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'playerId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'createdBy',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'processing'",
          },
          {
            name: 'type',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'source',
            type: 'varchar',
            length: '50',
            default: "'auto_generated'",
          },
          {
            name: 'title',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'startTime',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'endTime',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'duration',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'thumbnailUrl',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'videoUrl',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'downloadUrl',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'embedUrl',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'videoMetadata',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'processingMetadata',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'aiMetadata',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'engagement',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'metadata',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'rejectionReason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'approvedBy',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'approvedAt',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'publishedAt',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'expiresAt',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'region',
            type: 'varchar',
            length: '50',
            default: "'global'",
          },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['streamSessionId'],
            referencedTableName: 'stream_sessions',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['matchId'],
            referencedTableName: 'matches',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['tournamentId'],
            referencedTableName: 'tournaments',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['playerId'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['createdBy'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['approvedBy'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
        indices: [
          {
            name: 'IDX_highlights_streamSessionId',
            columnNames: ['streamSessionId'],
          },
          {
            name: 'IDX_highlights_matchId',
            columnNames: ['matchId'],
          },
          {
            name: 'IDX_highlights_tournamentId',
            columnNames: ['tournamentId'],
          },
          {
            name: 'IDX_highlights_playerId',
            columnNames: ['playerId'],
          },
          {
            name: 'IDX_highlights_status',
            columnNames: ['status'],
          },
          {
            name: 'IDX_highlights_type',
            columnNames: ['type'],
          },
          {
            name: 'IDX_highlights_source',
            columnNames: ['source'],
          },
          {
            name: 'IDX_highlights_createdAt',
            columnNames: ['createdAt'],
          },
        ],
      }),
      true
    );

    // Create cdn_uploads table
    await queryRunner.createTable(
      new Table({
        name: 'cdn_uploads',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'recordingId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'highlightId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'uploadedBy',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'pending'",
          },
          {
            name: 'type',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'provider',
            type: 'varchar',
            length: '50',
            default: "'aws_s3'",
          },
          {
            name: 'originalFileName',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'fileName',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'filePath',
            type: 'varchar',
            length: '500',
            isNullable: false,
          },
          {
            name: 'bucket',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'region',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'cdnUrl',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'signedUrl',
            type: 'varchar',
            length: '1024',
            isNullable: true,
          },
          {
            name: 'signedUrlExpiry',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'thumbnailUrl',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'previewUrl',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'downloadUrl',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'embedUrl',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'fileMetadata',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'uploadMetadata',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'processingMetadata',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'storageMetadata',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'analytics',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'metadata',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'errorMessage',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'retryCount',
            type: 'int',
            default: 0,
          },
          {
            name: 'lastRetryAt',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'expiresAt',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'archivedAt',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'region',
            type: 'varchar',
            length: '50',
            default: "'global'",
          },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['recordingId'],
            referencedTableName: 'recordings',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['highlightId'],
            referencedTableName: 'highlights',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['uploadedBy'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        indices: [
          {
            name: 'IDX_cdn_uploads_uploadedBy',
            columnNames: ['uploadedBy'],
          },
          {
            name: 'IDX_cdn_uploads_status',
            columnNames: ['status'],
          },
          {
            name: 'IDX_cdn_uploads_type',
            columnNames: ['type'],
          },
          {
            name: 'IDX_cdn_uploads_provider',
            columnNames: ['provider'],
          },
          {
            name: 'IDX_cdn_uploads_recordingId',
            columnNames: ['recordingId'],
          },
          {
            name: 'IDX_cdn_uploads_highlightId',
            columnNames: ['highlightId'],
          },
          {
            name: 'IDX_cdn_uploads_createdAt',
            columnNames: ['createdAt'],
          },
        ],
      }),
      true
    );

    // Create stream_webhooks table
    await queryRunner.createTable(
      new Table({
        name: 'stream_webhooks',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'streamSessionId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'recordingId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'highlightId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'uploadId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'type',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'pending'",
          },
          {
            name: 'provider',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'endpoint',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'event_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'payload',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'headers',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'signature',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'response',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'processingMetadata',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'errorMessage',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'deliveredAt',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'expiresAt',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'region',
            type: 'varchar',
            length: '50',
            default: "'global'",
          },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['streamSessionId'],
            referencedTableName: 'stream_sessions',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['recordingId'],
            referencedTableName: 'recordings',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['highlightId'],
            referencedTableName: 'highlights',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['uploadId'],
            referencedTableName: 'cdn_uploads',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        indices: [
          {
            name: 'IDX_stream_webhooks_streamSessionId',
            columnNames: ['streamSessionId'],
          },
          {
            name: 'IDX_stream_webhooks_type',
            columnNames: ['type'],
          },
          {
            name: 'IDX_stream_webhooks_status',
            columnNames: ['status'],
          },
          {
            name: 'IDX_stream_webhooks_provider',
            columnNames: ['provider'],
          },
          {
            name: 'IDX_stream_webhooks_createdAt',
            columnNames: ['createdAt'],
          },
        ],
      }),
      true
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables
    await queryRunner.dropTable('stream_webhooks');
    await queryRunner.dropTable('cdn_uploads');
    await queryRunner.dropTable('highlights');
  }
}
