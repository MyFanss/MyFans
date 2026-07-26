import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFavorites1753100000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "favorites" (
        "id"        uuid              NOT NULL DEFAULT uuid_generate_v4(),
        "userId"    uuid              NOT NULL,
        "creatorId" uuid              NOT NULL,
        "createdAt" TIMESTAMP         NOT NULL DEFAULT now(),
        CONSTRAINT "PK_favorites" PRIMARY KEY ("id"),
        CONSTRAINT "unique_favorite" UNIQUE ("userId", "creatorId"),
        CONSTRAINT "FK_favorites_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_favorites_creatorId" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_favorites_userId" ON "favorites" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_favorites_creatorId" ON "favorites" ("creatorId")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_favorites_creatorId"`);
    await queryRunner.query(`DROP INDEX "IDX_favorites_userId"`);
    await queryRunner.query(`DROP TABLE "favorites"`);
  }
}
