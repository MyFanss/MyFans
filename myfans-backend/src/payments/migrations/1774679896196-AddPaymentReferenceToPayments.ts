import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentReferenceToPayments1774679896196
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payments" ADD COLUMN "payment_reference" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "UQ_payments_payment_reference" UNIQUE ("payment_reference")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "UQ_payments_payment_reference"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP COLUMN "payment_reference"`,
    );
  }
}
