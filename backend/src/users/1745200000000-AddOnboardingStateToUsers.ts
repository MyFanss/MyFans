import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddOnboardingStateToUsers1745200000000 implements MigrationInterface {
  name = 'AddOnboardingStateToUsers1745200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'onboarding_state',
        type: 'jsonb',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'onboarding_state');
  }
}

