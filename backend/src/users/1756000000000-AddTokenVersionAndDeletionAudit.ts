import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex } from 'typeorm';

export class AddTokenVersionAndDeletionAudit1756000000000
  implements MigrationInterface
{
  name = 'AddTokenVersionAndDeletionAudit1756000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'token_version',
        type: 'int',
        default: 0,
        isNullable: false,
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'account_deletion_audit_logs',
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
            name: 'details',
            type: 'text',
            isNullable: true,
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
      'account_deletion_audit_logs',
      new TableIndex({
        name: 'IDX_account_deletion_audit_logs_user_id',
        columnNames: ['user_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('account_deletion_audit_logs', true);
    await queryRunner.dropColumn('users', 'token_version');
  }
}
