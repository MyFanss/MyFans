import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the 'suppressed' status used when an email's recipient account has
 * been deleted (#1566) — see EmailOutboxService#isRecipientDeleted.
 */
export class AddSuppressedToEmailOutboxStatus1756000000100
  implements MigrationInterface
{
  name = 'AddSuppressedToEmailOutboxStatus1756000000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "email_outbox_status_enum" ADD VALUE IF NOT EXISTS 'suppressed'`,
    );
  }

  public async down(): Promise<void> {
    // Postgres does not support removing a value from an enum type; a
    // rollback would require recreating the type and column, which risks
    // data loss for any row already using this status. Left as a no-op.
  }
}
