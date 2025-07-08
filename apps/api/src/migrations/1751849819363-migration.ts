import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1751849819363 implements MigrationInterface {
  name = "Migration1751849819363";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "password"`);
    await queryRunner.query(
      `ALTER TABLE "sandbox" ALTER COLUMN "authToken" SET DEFAULT MD5(random()::text)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sandbox" ALTER COLUMN "authToken" SET DEFAULT md5((random()))`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD "password" character varying NOT NULL DEFAULT ''`,
    );
  }
}
