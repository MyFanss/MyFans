import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

export class CreateWalletLinks1756000000000 implements MigrationInterface {
  name = 'CreateWalletLinks1756000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'wallet_links',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'stellar_address',
            type: 'varchar',
            length: '56',
            isNullable: false,
          },
          {
            name: 'is_primary',
            type: 'boolean',
            default: true,
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'wallet_links',
      new TableIndex({
        name: 'UQ_wallet_links_stellar_address',
        columnNames: ['stellar_address'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'wallet_links',
      new TableIndex({
        name: 'IDX_wallet_links_user_id',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createForeignKey(
      'wallet_links',
      new TableForeignKey({
        name: 'FK_wallet_links_user_id',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('wallet_links', true);
  }
}
