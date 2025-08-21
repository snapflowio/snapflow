import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1755663032489 implements MigrationInterface {
  name = "Migration1755663032489";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user" ("id" character varying NOT NULL, "name" character varying NOT NULL, "email" character varying NOT NULL DEFAULT '', "emailVerified" boolean NOT NULL DEFAULT false, "role" "public"."user_role_enum" NOT NULL DEFAULT 'user', CONSTRAINT "user_id_pk" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "sandbox_usage_periods" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sandboxId" character varying NOT NULL, "organizationId" character varying NOT NULL, "startAt" TIMESTAMP NOT NULL, "endAt" TIMESTAMP, "cpu" double precision NOT NULL, "gpu" double precision NOT NULL, "mem" double precision NOT NULL, "disk" double precision NOT NULL, "region" character varying NOT NULL, "billed" boolean NOT NULL DEFAULT false, CONSTRAINT "sandbox_usage_periods_id_pk" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "api_key" ("organizationId" uuid NOT NULL, "userId" character varying NOT NULL, "name" character varying NOT NULL, "keyHash" character varying NOT NULL, "keyPrefix" character varying NOT NULL, "keySuffix" character varying NOT NULL, "permissions" "public"."api_key_permissions_enum" array NOT NULL, "createdAt" TIMESTAMP NOT NULL, "lastUsedAt" TIMESTAMP, "expiresAt" TIMESTAMP, CONSTRAINT "api_key_key_hash_unique" UNIQUE ("keyHash"), CONSTRAINT "api_key_organization_id_user_id_name_pk" PRIMARY KEY ("organizationId", "userId", "name"))`
    );
    await queryRunner.query(
      `CREATE TABLE "warm_pool" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "pool" integer NOT NULL, "image" character varying NOT NULL, "target" "public"."warm_pool_target_enum" NOT NULL DEFAULT 'eu', "cpu" integer NOT NULL, "mem" integer NOT NULL, "disk" integer NOT NULL, "gpu" integer NOT NULL, "gpuType" character varying NOT NULL, "class" "public"."warm_pool_class_enum" NOT NULL DEFAULT 'small', "osUser" character varying NOT NULL, "errorReason" character varying, "env" text NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "warm_pool_id_pk" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "image_executor" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "state" "public"."image_executor_state_enum" NOT NULL DEFAULT 'pulling_image', "errorReason" character varying, "imageRef" character varying NOT NULL DEFAULT '', "executorId" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "image_executor_id_pk" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "image" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizationId" uuid, "general" boolean NOT NULL DEFAULT false, "name" character varying NOT NULL, "imageName" character varying NOT NULL, "internalName" character varying, "enabled" boolean NOT NULL DEFAULT true, "state" "public"."image_state_enum" NOT NULL DEFAULT 'pending', "errorReason" character varying, "size" double precision, "cpu" integer NOT NULL DEFAULT '1', "gpu" integer NOT NULL DEFAULT '0', "mem" integer NOT NULL DEFAULT '1', "disk" integer NOT NULL DEFAULT '3', "hideFromUsers" boolean NOT NULL DEFAULT false, "entrypoint" text array, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "lastUsedAt" TIMESTAMP, "buildExecutorId" character varying, "buildInfoImageRef" character varying, CONSTRAINT "image_organization_id_name_unique" UNIQUE ("organizationId", "name"), CONSTRAINT "image_id_pk" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "build_info" ("imageRef" character varying NOT NULL, "dockerfileContent" text, "contextHashes" text, "lastUsedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "build_info_image_ref_pk" PRIMARY KEY ("imageRef"))`
    );
    await queryRunner.query(
      `CREATE TABLE "sandbox" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizationId" uuid NOT NULL, "region" "public"."sandbox_region_enum" NOT NULL DEFAULT 'eu', "executorId" uuid, "prevExecutorId" uuid, "class" "public"."sandbox_class_enum" NOT NULL DEFAULT 'small', "state" "public"."sandbox_state_enum" NOT NULL DEFAULT 'unknown', "desiredState" "public"."sandbox_desiredstate_enum" NOT NULL DEFAULT 'started', "image" character varying, "osUser" character varying NOT NULL, "errorReason" character varying, "env" jsonb NOT NULL DEFAULT '{}', "public" boolean NOT NULL DEFAULT false, "labels" jsonb, "backupRegistryId" character varying, "backupImage" character varying, "lastBackupAt" TIMESTAMP, "backupState" "public"."sandbox_backupstate_enum" NOT NULL DEFAULT 'None', "existingBackupImages" jsonb NOT NULL DEFAULT '[]', "cpu" integer NOT NULL DEFAULT '2', "gpu" integer NOT NULL DEFAULT '0', "mem" integer NOT NULL DEFAULT '4', "disk" integer NOT NULL DEFAULT '10', "buckets" jsonb NOT NULL DEFAULT '[]', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "lastActivityAt" TIMESTAMP, "autoStopInterval" integer NOT NULL DEFAULT '15', "autoArchiveInterval" integer NOT NULL DEFAULT '10080', "pending" boolean NOT NULL DEFAULT false, "authToken" character varying NOT NULL DEFAULT MD5(random()::text), "nodeVersion" character varying, "buildInfoImageRef" character varying, CONSTRAINT "sandbox_id_pk" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "executor" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "domain" character varying NOT NULL, "apiUrl" character varying NOT NULL, "apiKey" character varying NOT NULL, "cpu" integer NOT NULL, "memory" integer NOT NULL, "disk" integer NOT NULL, "gpu" integer NOT NULL, "gpuType" character varying NOT NULL, "class" "public"."executor_class_enum" NOT NULL DEFAULT 'small', "used" integer NOT NULL DEFAULT '0', "capacity" integer NOT NULL, "region" "public"."executor_region_enum" NOT NULL, "state" "public"."executor_state_enum" NOT NULL DEFAULT 'initializing', "lastChecked" TIMESTAMP, "unschedulable" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "executor_domain_unique" UNIQUE ("domain"), CONSTRAINT "executor_id_pk" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "bucket" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizationId" uuid, "name" character varying NOT NULL, "state" "public"."bucket_state_enum" NOT NULL DEFAULT 'pending_create', "errorReason" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "lastUsedAt" TIMESTAMP, CONSTRAINT "bucket_organization_id_name_unique" UNIQUE ("organizationId", "name"), CONSTRAINT "bucket_id_pk" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "organization_user" ("organizationId" uuid NOT NULL, "userId" character varying NOT NULL, "role" "public"."organization_user_role_enum" NOT NULL DEFAULT 'member', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "organization_user_organization_id_user_id_pk" PRIMARY KEY ("organizationId", "userId"))`
    );
    await queryRunner.query(
      `CREATE TABLE "organization_role" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" character varying NOT NULL, "permissions" "public"."organization_role_permissions_enum" array NOT NULL, "isGlobal" boolean NOT NULL DEFAULT false, "organizationId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "organization_role_id_pk" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "organization_invitation" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizationId" uuid NOT NULL, "email" character varying NOT NULL, "invitedBy" character varying NOT NULL DEFAULT '', "role" "public"."organization_invitation_role_enum" NOT NULL DEFAULT 'member', "expiresAt" TIMESTAMP NOT NULL, "status" "public"."organization_invitation_status_enum" NOT NULL DEFAULT 'pending', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "organization_invitation_id_pk" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "organization" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "createdBy" character varying NOT NULL, "personal" boolean NOT NULL DEFAULT false, "wallet" numeric(12,6) NOT NULL DEFAULT '0.000000', "telemetryEnabled" boolean NOT NULL DEFAULT true, "total_cpu_quota" integer NOT NULL DEFAULT '10', "total_memory_quota" integer NOT NULL DEFAULT '10', "total_disk_quota" integer NOT NULL DEFAULT '30', "max_cpu_per_sandbox" integer NOT NULL DEFAULT '4', "max_memory_per_sandbox" integer NOT NULL DEFAULT '8', "max_disk_per_sandbox" integer NOT NULL DEFAULT '10', "max_image_size" integer NOT NULL DEFAULT '20', "image_quota" integer NOT NULL DEFAULT '100', "bucket_quota" integer NOT NULL DEFAULT '100', "suspended" boolean NOT NULL DEFAULT false, "suspendedAt" TIMESTAMP, "suspensionReason" character varying, "suspendedUntil" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "organization_id_pk" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "registry" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "url" character varying NOT NULL, "username" character varying NOT NULL, "password" character varying NOT NULL, "isDefault" boolean NOT NULL DEFAULT false, "project" character varying NOT NULL, "organizationId" uuid, "registryType" "public"."registry_registrytype_enum" NOT NULL DEFAULT 'internal', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "registry_id_pk" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "organization_role_assignment" ("organizationId" uuid NOT NULL, "userId" character varying NOT NULL, "roleId" uuid NOT NULL, CONSTRAINT "organization_role_assignment_organization_id_user_id_role_id_pk" PRIMARY KEY ("organizationId", "userId", "roleId"))`
    );
    await queryRunner.query(
      `CREATE INDEX "organization_role_assignment_organization_id_user_id_index" ON "organization_role_assignment" ("organizationId", "userId") `
    );
    await queryRunner.query(
      `CREATE INDEX "organization_role_assignment_role_id_index" ON "organization_role_assignment" ("roleId") `
    );
    await queryRunner.query(
      `CREATE TABLE "organization_role_assignment_invitation" ("invitationId" uuid NOT NULL, "roleId" uuid NOT NULL, CONSTRAINT "organization_role_assignment_invitation_invitation_id_role_id_pk" PRIMARY KEY ("invitationId", "roleId"))`
    );
    await queryRunner.query(
      `CREATE INDEX "organization_role_assignment_invitation_invitation_id_index" ON "organization_role_assignment_invitation" ("invitationId") `
    );
    await queryRunner.query(
      `CREATE INDEX "organization_role_assignment_invitation_role_id_index" ON "organization_role_assignment_invitation" ("roleId") `
    );
    await queryRunner.query(
      `ALTER TABLE "image" ADD CONSTRAINT "image_build_info_image_ref_fk" FOREIGN KEY ("buildInfoImageRef") REFERENCES "build_info"("imageRef") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "sandbox" ADD CONSTRAINT "sandbox_build_info_image_ref_fk" FOREIGN KEY ("buildInfoImageRef") REFERENCES "build_info"("imageRef") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "organization_user" ADD CONSTRAINT "organization_user_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "organization_role" ADD CONSTRAINT "organization_role_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "organization_invitation" ADD CONSTRAINT "organization_invitation_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "organization_role_assignment" ADD CONSTRAINT "organization_role_assignment_organization_id_user_id_fk" FOREIGN KEY ("organizationId", "userId") REFERENCES "organization_user"("organizationId","userId") ON DELETE CASCADE ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "organization_role_assignment" ADD CONSTRAINT "organization_role_assignment_role_id_fk" FOREIGN KEY ("roleId") REFERENCES "organization_role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "organization_role_assignment_invitation" ADD CONSTRAINT "organization_role_assignment_invitation_invitation_id_fk" FOREIGN KEY ("invitationId") REFERENCES "organization_invitation"("id") ON DELETE CASCADE ON UPDATE CASCADE`
    );
    await queryRunner.query(
      `ALTER TABLE "organization_role_assignment_invitation" ADD CONSTRAINT "organization_role_assignment_invitation_role_id_fk" FOREIGN KEY ("roleId") REFERENCES "organization_role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "organization_role_assignment_invitation" DROP CONSTRAINT "organization_role_assignment_invitation_role_id_fk"`
    );
    await queryRunner.query(
      `ALTER TABLE "organization_role_assignment_invitation" DROP CONSTRAINT "organization_role_assignment_invitation_invitation_id_fk"`
    );
    await queryRunner.query(
      `ALTER TABLE "organization_role_assignment" DROP CONSTRAINT "organization_role_assignment_role_id_fk"`
    );
    await queryRunner.query(
      `ALTER TABLE "organization_role_assignment" DROP CONSTRAINT "organization_role_assignment_organization_id_user_id_fk"`
    );
    await queryRunner.query(
      `ALTER TABLE "organization_invitation" DROP CONSTRAINT "organization_invitation_organization_id_fk"`
    );
    await queryRunner.query(
      `ALTER TABLE "organization_role" DROP CONSTRAINT "organization_role_organization_id_fk"`
    );
    await queryRunner.query(
      `ALTER TABLE "organization_user" DROP CONSTRAINT "organization_user_organization_id_fk"`
    );
    await queryRunner.query(
      `ALTER TABLE "sandbox" DROP CONSTRAINT "sandbox_build_info_image_ref_fk"`
    );
    await queryRunner.query(`ALTER TABLE "image" DROP CONSTRAINT "image_build_info_image_ref_fk"`);
    await queryRunner.query(
      `DROP INDEX "public"."organization_role_assignment_invitation_role_id_index"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."organization_role_assignment_invitation_invitation_id_index"`
    );
    await queryRunner.query(`DROP TABLE "organization_role_assignment_invitation"`);
    await queryRunner.query(`DROP INDEX "public"."organization_role_assignment_role_id_index"`);
    await queryRunner.query(
      `DROP INDEX "public"."organization_role_assignment_organization_id_user_id_index"`
    );
    await queryRunner.query(`DROP TABLE "organization_role_assignment"`);
    await queryRunner.query(`DROP TABLE "registry"`);
    await queryRunner.query(`DROP TABLE "organization"`);
    await queryRunner.query(`DROP TABLE "organization_invitation"`);
    await queryRunner.query(`DROP TABLE "organization_role"`);
    await queryRunner.query(`DROP TABLE "organization_user"`);
    await queryRunner.query(`DROP TABLE "bucket"`);
    await queryRunner.query(`DROP TABLE "executor"`);
    await queryRunner.query(`DROP TABLE "sandbox"`);
    await queryRunner.query(`DROP TABLE "build_info"`);
    await queryRunner.query(`DROP TABLE "image"`);
    await queryRunner.query(`DROP TABLE "image_executor"`);
    await queryRunner.query(`DROP TABLE "warm_pool"`);
    await queryRunner.query(`DROP TABLE "api_key"`);
    await queryRunner.query(`DROP TABLE "sandbox_usage_periods"`);
    await queryRunner.query(`DROP TABLE "user"`);
  }
}
