import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

/**
 * Adds rotation-with-reuse-detection support to the existing `refresh_tokens`
 * table (#1565): a `family_id` grouping every token issued from the same
 * original login/refresh chain, and a `revoked` flag set on a token once
 * it's been rotated away. Reusing a `revoked` token revokes its whole family.
 */
export class AddRotationToRefreshTokens1756000000200
  implements MigrationInterface
{
  name = 'AddRotationToRefreshTokens1756000000200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('refresh_tokens', [
      new TableColumn({
        name: 'family_id',
        type: 'uuid',
        isNullable: true,
      }),
      new TableColumn({
        name: 'revoked',
        type: 'boolean',
        default: false,
        isNullable: false,
      }),
    ]);

    // Backfill: any pre-existing row (from the old, never-wired-up
    // refresh-module) becomes the sole member of its own family.
    await queryRunner.query(
      `UPDATE "refresh_tokens" SET "family_id" = "id" WHERE "family_id" IS NULL`,
    );

    await queryRunner.changeColumn(
      'refresh_tokens',
      'family_id',
      new TableColumn({ name: 'family_id', type: 'uuid', isNullable: false }),
    );

    await queryRunner.createIndex(
      'refresh_tokens',
      new TableIndex({
        name: 'IDX_refresh_tokens_family_id',
        columnNames: ['family_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('refresh_tokens', 'IDX_refresh_tokens_family_id');
    await queryRunner.dropColumn('refresh_tokens', 'revoked');
    await queryRunner.dropColumn('refresh_tokens', 'family_id');
  }
}
