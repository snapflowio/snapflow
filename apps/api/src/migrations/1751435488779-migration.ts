import type { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1751435488779 implements MigrationInterface {
  name = "Migration1751435488779";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."api_key_permissions_enum" AS ENUM('write:registries', 'delete:registries', 'write:snapshots', 'delete:snapshots', 'write:sandboxes', 'delete:sandboxes', 'read:volumes', 'write:volumes', 'delete:volumes')`,
    );
    await queryRunner.query(
      `CREATE TABLE "api_key" ("organizationId" uuid NOT NULL, "userId" character varying NOT NULL, "name" character varying NOT NULL, "keyHash" character varying NOT NULL DEFAULT '', "keyPrefix" character varying NOT NULL DEFAULT '', "keySuffix" character varying NOT NULL DEFAULT '', "permissions" "public"."api_key_permissions_enum" array NOT NULL, "createdAt" TIMESTAMP NOT NULL, "lastUsedAt" TIMESTAMP, "expiresAt" TIMESTAMP, CONSTRAINT "api_key_keyHash_unique" UNIQUE ("keyHash"), CONSTRAINT "api_key_organizationId_userId_name_pk" PRIMARY KEY ("organizationId", "userId", "name"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "api_key"`);
    await queryRunner.query(`DROP TYPE "public"."api_key_permissions_enum"`);
  }
}
