import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateIdempotencyKeys1711554835000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'idempotency_keys',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          { name: 'key', type: 'varchar', length: '255', isNullable: false },
          { name: 'fingerprint', type: 'varchar', length: '255', isNullable: false },
          { name: 'method', type: 'varchar', length: '10', isNullable: false },
          { name: 'path', type: 'varchar', length: '500', isNullable: false },
          { name: 'response_status', type: 'int', isNullable: true },
          { name: 'response_body', type: 'text', isNullable: true },
          { name: 'is_complete', type: 'boolean', default: false },
          { name: 'expires_at', type: 'timestamptz', isNullable: false },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    // Unique constraint: one record per (key, fingerprint) pair.
    await queryRunner.createIndex(
      'idempotency_keys',
      new TableIndex({
        name: 'UQ_idempotency_keys_key_fingerprint',
        columnNames: ['key', 'fingerprint'],
        isUnique: true,
      }),
    );

    // Index on expires_at for efficient cleanup queries.
    await queryRunner.createIndex(
      'idempotency_keys',
      new TableIndex({
        name: 'IDX_idempotency_keys_expires_at',
        columnNames: ['expires_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('idempotency_keys', true);
  }
}
