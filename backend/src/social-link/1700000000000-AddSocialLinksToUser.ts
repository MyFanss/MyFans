import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSocialLinksToUser1700000000000 implements MigrationInterface {
  name = 'AddSocialLinksToUser1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('users', [
      new TableColumn({
        name: 'website_url',
        type: 'varchar',
        length: '500',
        isNullable: true,
        default: null,
      }),
      new TableColumn({
        name: 'twitter_handle',
        type: 'varchar',
        length: '50',
        isNullable: true,
        default: null,
      }),
      new TableColumn({
        name: 'instagram_handle',
        type: 'varchar',
        length: '50',
        isNullable: true,
        default: null,
      }),
      new TableColumn({
        name: 'other_link',
        type: 'varchar',
        length: '500',
        isNullable: true,
        default: null,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'website_url');
    await queryRunner.dropColumn('users', 'twitter_handle');
    await queryRunner.dropColumn('users', 'instagram_handle');
    await queryRunner.dropColumn('users', 'other_link');
  }
}
