import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class CreateStreamTables1764037061 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create stream_sessions table
    await queryRunner.createTable(
      new Table({
        name: 'stream_sessions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'tournamentId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'matchId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'streamerId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'varchar',
            length: '50',
            default: "'match'",
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'pending'",
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
            name: 'thumbnailUrl',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'streamKey',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'rtmpUrl',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'hlsUrl',
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
            name: 'quality',
            type: 'varchar',
            length: '50',
            default: "'auto'",
          },
          {
            name: 'viewerCount',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'maxViewers',
            type: 'int',
            default: 0,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'streamStats',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'recordingMetadata',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'highlightMarkers',
            type: 'jsonb',
            default: "'[]'",
          },
          {
            name: 'scheduledFor',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'startedAt',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'endedAt',
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
            columnNames: ['tournamentId'],
            referencedTableName: 'tournaments',
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
            columnNames: ['streamerId'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        indices: [
          {
            name: 'IDX_stream_sessions_tournamentId',
            columnNames: ['tournamentId'],
          },
          {
            name: 'IDX_stream_sessions_matchId',
            columnNames: ['matchId'],
          },
          {
            name: 'IDX_stream_sessions_streamerId',
            columnNames: ['streamerId'],
          },
          {
            name: 'IDX_stream_sessions_status',
            columnNames: ['status'],
          },
          {
            name: 'IDX_stream_sessions_type',
            columnNames: ['type'],
          },
          {
            name: 'IDX_stream_sessions_startedAt',
            columnNames: ['startedAt'],
          },
        ],
      }),
      true
    );

    // Create recordings table
    await queryRunner.createTable(
      new Table({
        name: 'recordings',
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
            name: 'recordedBy',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'initializing'",
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
            name: 'format',
            type: 'varchar',
            length: '50',
            default: "'mp4'",
          },
          {
            name: 'quality',
            type: 'varchar',
            length: '50',
            default: "'1080p'",
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
            name: 'videoMetadata',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'recordingMetadata',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'processingMetadata',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'clipMarkers',
            type: 'jsonb',
            default: "'[]'",
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
            name: 'startedAt',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'endedAt',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'archivedAt',
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
            columnNames: ['recordedBy'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        indices: [
          {
            name: 'IDX_recordings_streamSessionId',
            columnNames: ['streamSessionId'],
          },
          {
            name: 'IDX_recordings_matchId',
            columnNames: ['matchId'],
          },
          {
            name: 'IDX_recordings_tournamentId',
            columnNames: ['tournamentId'],
          },
          {
            name: 'IDX_recordings_recordedBy',
            columnNames: ['recordedBy'],
          },
          {
            name: 'IDX_recordings_status',
            columnNames: ['status'],
          },
          {
            name: 'IDX_recordings_format',
            columnNames: ['format'],
          },
          {
            name: 'IDX_recordings_startedAt',
            columnNames: ['startedAt'],
          },
        ],
      }),
      true
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables
    await queryRunner.dropTable('recordings');
    await queryRunner.dropTable('stream_sessions');
  }
}
