import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1753134932527 implements MigrationInterface {
    name = 'Migration1753134932527'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sandbox" RENAME COLUMN "daemonVersion" TO "nodeVersion"`);
        await queryRunner.query(`ALTER TABLE "sandbox" ALTER COLUMN "authToken" SET DEFAULT MD5(random()::text)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sandbox" ALTER COLUMN "authToken" SET DEFAULT md5((random()))`);
        await queryRunner.query(`ALTER TABLE "sandbox" RENAME COLUMN "nodeVersion" TO "daemonVersion"`);
    }

}
