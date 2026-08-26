import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateContentConversationsGames1751000000000 implements MigrationInterface {
  name = 'CreateContentConversationsGames1751000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DO $$ BEGIN CREATE TYPE "content_metadata_content_type_enum" AS ENUM ('image','video','audio','document'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await queryRunner.query(
      `DO $$ BEGIN CREATE TYPE "games_status_enum" AS ENUM ('PENDING','IN_PROGRESS','COMPLETED'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "content_metadata" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "creator_id" varchar NOT NULL, "title" varchar NOT NULL, "description" text, "ipfs_cid" varchar NOT NULL, "ipfs_url" varchar, "content_type" "content_metadata_content_type_enum" NOT NULL DEFAULT 'image', "subscription_tier" varchar, "is_published" boolean NOT NULL DEFAULT false, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now())`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_content_creator" ON "content_metadata" ("creator_id")`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "conversations" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "participant1Id" varchar NOT NULL, "participant2Id" varchar NOT NULL, "lastMessageId" varchar, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now())`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "messages" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "conversationId" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE, "senderId" varchar NOT NULL, "content" text NOT NULL, "isRead" boolean NOT NULL DEFAULT false, "createdAt" timestamptz NOT NULL DEFAULT now())`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_messages_conversation" ON "messages" ("conversationId")`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "games" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "status" "games_status_enum" NOT NULL DEFAULT 'PENDING', "number_of_players" integer NOT NULL, "game_settings" jsonb NOT NULL, "host_user_id" varchar, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now())`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "players" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "game_id" uuid NOT NULL REFERENCES "games"("id") ON DELETE CASCADE, "user_id" varchar NOT NULL, "balance" numeric(10,2) NOT NULL, "turn_order" integer, "symbol" varchar, "created_at" timestamptz NOT NULL DEFAULT now(), CONSTRAINT "UQ_player_game_user" UNIQUE ("game_id", "user_id"))`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "players", "games", "messages", "conversations", "content_metadata" CASCADE`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "games_status_enum", "content_metadata_content_type_enum"`,
    );
  }
}
