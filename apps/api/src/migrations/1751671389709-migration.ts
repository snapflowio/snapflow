import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1751671389709 implements MigrationInterface {
  name = "Migration1751671389709";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."user_role_enum" AS ENUM('admin', 'user')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user" ("id" character varying NOT NULL, "name" character varying NOT NULL, "email" character varying NOT NULL DEFAULT '', "emailVerified" boolean NOT NULL DEFAULT false, "role" "public"."user_role_enum" NOT NULL DEFAULT 'user', CONSTRAINT "user_id_pk" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."organization_invitation_role_enum" AS ENUM('owner', 'member')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."organization_invitation_status_enum" AS ENUM('pending', 'accepted', 'declined', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "organization_invitation" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizationId" uuid NOT NULL, "email" character varying NOT NULL, "invitedBy" character varying NOT NULL DEFAULT '', "role" "public"."organization_invitation_role_enum" NOT NULL DEFAULT 'member', "expiresAt" TIMESTAMP NOT NULL, "status" "public"."organization_invitation_status_enum" NOT NULL DEFAULT 'pending', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "organization_invitation_id_pk" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."organization_user_role_enum" AS ENUM('owner', 'member')`,
    );
    await queryRunner.query(
      `CREATE TABLE "organization_user" ("organizationId" uuid NOT NULL, "userId" character varying NOT NULL, "role" "public"."organization_user_role_enum" NOT NULL DEFAULT 'member', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "organization_user_organizationId_userId_pk" PRIMARY KEY ("organizationId", "userId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "organization" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "createdBy" character varying NOT NULL, "personal" boolean NOT NULL DEFAULT false, "telemetryEnabled" boolean NOT NULL DEFAULT true, "total_cpu_quota" integer NOT NULL DEFAULT '10', "total_memory_quota" integer NOT NULL DEFAULT '10', "total_disk_quota" integer NOT NULL DEFAULT '30', "max_cpu_per_sandbox" integer NOT NULL DEFAULT '4', "max_memory_per_sandbox" integer NOT NULL DEFAULT '8', "max_disk_per_sandbox" integer NOT NULL DEFAULT '10', "max_snapshot_size" integer NOT NULL DEFAULT '20', "snapshot_quota" integer NOT NULL DEFAULT '100', "volume_quota" integer NOT NULL DEFAULT '100', "suspended" boolean NOT NULL DEFAULT false, "suspendedAt" TIMESTAMP, "suspensionReason" character varying, "suspendedUntil" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "organization_id_pk" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."organization_role_permissions_enum" AS ENUM('write:registries', 'delete:registries', 'write:snapshots', 'delete:snapshots', 'write:sandboxes', 'delete:sandboxes', 'read:volumes', 'write:volumes', 'delete:volumes')`,
    );
    await queryRunner.query(
      `CREATE TABLE "organization_role" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" character varying NOT NULL, "permissions" "public"."organization_role_permissions_enum" array NOT NULL, "isGlobal" boolean NOT NULL DEFAULT false, "organizationId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "organization_role_id_pk" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "organization_role_assignment_invitation" ("invitationId" uuid NOT NULL, "roleId" uuid NOT NULL, CONSTRAINT "organization_role_assignment_invitation_invitationId_roleId_pk" PRIMARY KEY ("invitationId", "roleId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "organization_role_assignment_invitation_invitationId_index" ON "organization_role_assignment_invitation" ("invitationId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "organization_role_assignment_invitation_roleId_index" ON "organization_role_assignment_invitation" ("roleId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "organization_role_assignment" ("organizationId" uuid NOT NULL, "userId" character varying NOT NULL, "roleId" uuid NOT NULL, CONSTRAINT "organization_role_assignment_organizationId_userId_roleId_pk" PRIMARY KEY ("organizationId", "userId", "roleId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "organization_role_assignment_organizationId_userId_index" ON "organization_role_assignment" ("organizationId", "userId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "organization_role_assignment_roleId_index" ON "organization_role_assignment" ("roleId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_invitation" ADD CONSTRAINT "organization_invitation_organizationId_fk" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_user" ADD CONSTRAINT "organization_user_organizationId_fk" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_role" ADD CONSTRAINT "organization_role_organizationId_fk" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_role_assignment_invitation" ADD CONSTRAINT "organization_role_assignment_invitation_invitationId_fk" FOREIGN KEY ("invitationId") REFERENCES "organization_invitation"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_role_assignment_invitation" ADD CONSTRAINT "organization_role_assignment_invitation_roleId_fk" FOREIGN KEY ("roleId") REFERENCES "organization_role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_role_assignment" ADD CONSTRAINT "organization_role_assignment_organizationId_userId_fk" FOREIGN KEY ("organizationId", "userId") REFERENCES "organization_user"("organizationId","userId") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_role_assignment" ADD CONSTRAINT "organization_role_assignment_roleId_fk" FOREIGN KEY ("roleId") REFERENCES "organization_role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organization_role_assignment" DROP CONSTRAINT "organization_role_assignment_roleId_fk"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_role_assignment" DROP CONSTRAINT "organization_role_assignment_organizationId_userId_fk"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_role_assignment_invitation" DROP CONSTRAINT "organization_role_assignment_invitation_roleId_fk"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_role_assignment_invitation" DROP CONSTRAINT "organization_role_assignment_invitation_invitationId_fk"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_role" DROP CONSTRAINT "organization_role_organizationId_fk"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_user" DROP CONSTRAINT "organization_user_organizationId_fk"`,
    );
    await queryRunner.query(
      `ALTER TABLE "organization_invitation" DROP CONSTRAINT "organization_invitation_organizationId_fk"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."organization_role_assignment_roleId_index"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."organization_role_assignment_organizationId_userId_index"`,
    );
    await queryRunner.query(`DROP TABLE "organization_role_assignment"`);
    await queryRunner.query(
      `DROP INDEX "public"."organization_role_assignment_invitation_roleId_index"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."organization_role_assignment_invitation_invitationId_index"`,
    );
    await queryRunner.query(
      `DROP TABLE "organization_role_assignment_invitation"`,
    );
    await queryRunner.query(`DROP TABLE "organization_role"`);
    await queryRunner.query(
      `DROP TYPE "public"."organization_role_permissions_enum"`,
    );
    await queryRunner.query(`DROP TABLE "organization"`);
    await queryRunner.query(`DROP TABLE "organization_user"`);
    await queryRunner.query(`DROP TYPE "public"."organization_user_role_enum"`);
    await queryRunner.query(`DROP TABLE "organization_invitation"`);
    await queryRunner.query(
      `DROP TYPE "public"."organization_invitation_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."organization_invitation_role_enum"`,
    );
    await queryRunner.query(`DROP TABLE "user"`);
    await queryRunner.query(`DROP TYPE "public"."user_role_enum"`);
  }
}
