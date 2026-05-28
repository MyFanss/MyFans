import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateFanSpendingCaps1746000000000 implements MigrationInterface {
  name = 'CreateFanSpendingCaps1746000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'fan_spending_caps',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'fan_address', type: 'varchar', length: '56', isNullable: false },
          { name: 'cap_amount', type: 'bigint', isNullable: true },
          { name: 'period', type: 'enum', enum: ['weekly', 'monthly', 'total'], default: "'monthly'" },
          { name: 'spent_amount', type: 'bigint', default: 0 },
          { name: 'period_started_at', type: 'timestamptz', isNullable: true },
          { name: 'updated_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'fan_spending_caps',
      new TableIndex({ name: 'UQ_fan_spending_caps_fan_address', columnNames: ['fan_address'], isUnique: true }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('fan_spending_caps');
  }
}
