import { MigrationInterface, QueryRunner, Table, Index } from 'typeorm';

export class CreateLeaderboardTables1764037061 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create standings table
    await queryRunner.createTable(
      new Table({
        name: 'standings',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'tournamentId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'teamId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'seasonId',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'type',
            type: 'varchar',
            length: '20',
            default: "'tournament'",
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'active'",
          },
          {
            name: 'rank',
            type: 'int',
            default: 0,
          },
          {
            name: 'points',
            type: 'int',
            default: 0,
          },
          {
            name: 'matchesPlayed',
            type: 'int',
            default: 0,
          },
          {
            name: 'wins',
            type: 'int',
            default: 0,
          },
          {
            name: 'losses',
            type: 'int',
            default: 0,
          },
          {
            name: 'draws',
            type: 'int',
            default: 0,
          },
          {
            name: 'kills',
            type: 'int',
            default: 0,
          },
          {
            name: 'deaths',
            type: 'int',
            default: 0,
          },
          {
            name: 'assists',
            type: 'int',
            default: 0,
          },
          {
            name: 'survivalTime',
            type: 'int',
            default: 0,
          },
          {
            name: 'avgPlacement',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'roundsWon',
            type: 'int',
            default: 0,
          },
          {
            name: 'roundsLost',
            type: 'int',
            default: 0,
          },
          {
            name: 'kdratio',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'adr',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'hsPercentage',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            default: "'{}'",
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
            columnNames: ['teamId'],
            referencedTableName: 'teams',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['userId'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        indices: [
          {
            name: 'IDX_standings_tournament_type_status',
            columnNames: ['tournamentId', 'type', 'status'],
          },
          {
            name: 'IDX_standings_team',
            columnNames: ['teamId'],
          },
          {
            name: 'IDX_standings_user',
            columnNames: ['userId'],
          },
          {
            name: 'IDX_standings_season',
            columnNames: ['seasonId'],
          },
          {
            name: 'IDX_standings_type_rank',
            columnNames: ['type', 'rank'],
          },
        ],
      }),
      true,
    );

    // Create leaderboard_snapshots table
    await queryRunner.createTable(
      new Table({
        name: 'leaderboard_snapshots',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'tournamentId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'seasonId',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'type',
            type: 'varchar',
            length: '20',
          },
          {
            name: 'category',
            type: 'varchar',
            length: '20',
          },
          {
            name: 'region',
            type: 'varchar',
            length: '50',
            default: "'global'",
          },
          {
            name: 'data',
            type: 'jsonb',
          },
          {
            name: 'snapshotKey',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'maxEntries',
            type: 'int',
            default: 100,
          },
          {
            name: 'filters',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'sortBy',
            type: 'varchar',
            length: '50',
            default: "'points'",
          },
          {
            name: 'sortOrder',
            type: 'varchar',
            length: '10',
            default: "'desc'",
          },
          {
            name: 'createdAt',
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
        ],
        indices: [
          {
            name: 'IDX_leaderboard_snapshots_type_category_season_region',
            columnNames: ['type', 'category', 'seasonId', 'region'],
          },
          {
            name: 'IDX_leaderboard_snapshots_tournament',
            columnNames: ['tournamentId'],
          },
          {
            name: 'IDX_leaderboard_snapshots_season',
            columnNames: ['seasonId'],
          },
          {
            name: 'IDX_leaderboard_snapshots_created_at',
            columnNames: ['createdAt'],
          },
        ],
      }),
      true,
    );

    // Create season_stats table
    await queryRunner.createTable(
      new Table({
        name: 'season_stats',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'seasonId',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'teamId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'type',
            type: 'varchar',
            length: '20',
          },
          {
            name: 'region',
            type: 'varchar',
            length: '50',
            default: "'global'",
          },
          {
            name: 'tournamentsPlayed',
            type: 'int',
            default: 0,
          },
          {
            name: 'tournamentsWon',
            type: 'int',
            default: 0,
          },
          {
            name: 'totalPoints',
            type: 'int',
            default: 0,
          },
          {
            name: 'avgPlacement',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'currentRank',
            type: 'int',
            default: 0,
          },
          {
            name: 'peakRank',
            type: 'int',
            default: 0,
          },
          {
            name: 'winRate',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'totalMatches',
            type: 'int',
            default: 0,
          },
          {
            name: 'totalWins',
            type: 'int',
            default: 0,
          },
          {
            name: 'totalLosses',
            type: 'int',
            default: 0,
          },
          {
            name: 'totalDraws',
            type: 'int',
            default: 0,
          },
          {
            name: 'totalKills',
            type: 'int',
            default: 0,
          },
          {
            name: 'totalDeaths',
            type: 'int',
            default: 0,
          },
          {
            name: 'totalAssists',
            type: 'int',
            default: 0,
          },
          {
            name: 'totalSurvivalTime',
            type: 'int',
            default: 0,
          },
          {
            name: 'avgKills',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'kdratio',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'totalRoundsWon',
            type: 'int',
            default: 0,
          },
          {
            name: 'totalRoundsLost',
            type: 'int',
            default: 0,
          },
          {
            name: 'totalADR',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'avgADR',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'totalHSPercentage',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'avgHSPercentage',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'weeklyStats',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'achievements',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'metadata',
            type: 'jsonb',
            default: "'{}'",
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
            columnNames: ['teamId'],
            referencedTableName: 'teams',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['userId'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        indices: [
          {
            name: 'IDX_season_stats_season_type',
            columnNames: ['seasonId', 'type'],
          },
          {
            name: 'IDX_season_stats_team',
            columnNames: ['teamId'],
          },
          {
            name: 'IDX_season_stats_user',
            columnNames: ['userId'],
          },
          {
            name: 'IDX_season_stats_region',
            columnNames: ['region'],
          },
          {
            name: 'IDX_season_stats_season_region_type',
            columnNames: ['seasonId', 'region', 'type'],
          },
        ],
      }),
      true,
    );

    // Create organizer_stats table
    await queryRunner.createTable(
      new Table({
        name: 'organizer_stats',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'organizerId',
            type: 'uuid',
          },
          {
            name: 'seasonId',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'region',
            type: 'varchar',
            length: '50',
            default: "'global'",
          },
          {
            name: 'tournamentsOrganized',
            type: 'int',
            default: 0,
          },
          {
            name: 'tournamentsCompleted',
            type: 'int',
            default: 0,
          },
          {
            name: 'tournamentsCancelled',
            type: 'int',
            default: 0,
          },
          {
            name: 'totalPrizePool',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'totalRevenue',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'totalFeesCollected',
            type: 'decimal',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'totalParticipants',
            type: 'int',
            default: 0,
          },
          {
            name: 'uniqueParticipants',
            type: 'int',
            default: 0,
          },
          {
            name: 'avgParticipantsPerTournament',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'participantRetentionRate',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'avgTournamentRating',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 0,
          },
          {
            name: 'totalRatings',
            type: 'int',
            default: 0,
          },
          {
            name: 'disputeRate',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 0,
          },
          {
            name: 'totalDisputes',
            type: 'int',
            default: 0,
          },
          {
            name: 'disputeResolutionRate',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 0,
          },
          {
            name: 'modeStats',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'organizerScore',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'organizerRank',
            type: 'int',
            default: 0,
          },
          {
            name: 'organizerScoreChange',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'achievements',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'monthlyStats',
            type: 'jsonb',
            default: "'{}'",
          },
          {
            name: 'metadata',
            type: 'jsonb',
            default: "'{}'",
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
            columnNames: ['organizerId'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        indices: [
          {
            name: 'IDX_organizer_stats_organizer',
            columnNames: ['organizerId'],
          },
          {
            name: 'IDX_organizer_stats_season',
            columnNames: ['seasonId'],
          },
          {
            name: 'IDX_organizer_stats_region',
            columnNames: ['region'],
          },
          {
            name: 'IDX_organizer_stats_season_region',
            columnNames: ['seasonId', 'region'],
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('organizer_stats');
    await queryRunner.dropTable('season_stats');
    await queryRunner.dropTable('leaderboard_snapshots');
    await queryRunner.dropTable('standings');
  }
}
