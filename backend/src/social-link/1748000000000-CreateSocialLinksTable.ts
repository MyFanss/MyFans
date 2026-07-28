import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateSocialLinksTable1748000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'social_links',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          { name: 'website_url', type: 'varchar', length: '500', isNullable: true, default: null },
          { name: 'twitter_handle', type: 'varchar', length: '50', isNullable: true, default: null },
          { name: 'instagram_handle', type: 'varchar', length: '50', isNullable: true, default: null },
          { name: 'other_link', type: 'varchar', length: '500', isNullable: true, default: null },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('social_links', true);
  }
}
