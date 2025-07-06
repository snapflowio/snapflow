import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1751784196393 implements MigrationInterface {
    name = 'Migration1751784196393'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "sandbox_usage_periods" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sandboxId" character varying NOT NULL, "organizationId" character varying NOT NULL, "startAt" TIMESTAMP NOT NULL, "endAt" TIMESTAMP, "cpu" double precision NOT NULL, "gpu" double precision NOT NULL, "mem" double precision NOT NULL, "disk" double precision NOT NULL, "region" character varying NOT NULL, CONSTRAINT "sandbox_usage_periods_id_pk" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."warm_pool_target_enum" AS ENUM('eu', 'us', 'asia')`);
        await queryRunner.query(`CREATE TYPE "public"."warm_pool_class_enum" AS ENUM('small', 'medium', 'large')`);
        await queryRunner.query(`CREATE TABLE "warm_pool" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "pool" integer NOT NULL, "snapshot" character varying NOT NULL, "target" "public"."warm_pool_target_enum" NOT NULL DEFAULT 'eu', "cpu" integer NOT NULL, "mem" integer NOT NULL, "disk" integer NOT NULL, "gpu" integer NOT NULL, "gpuType" character varying NOT NULL, "class" "public"."warm_pool_class_enum" NOT NULL DEFAULT 'small', "osUser" character varying NOT NULL, "errorReason" character varying, "env" text NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "warm_pool_id_pk" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."volume_state_enum" AS ENUM('creating', 'ready', 'pending_create', 'pending_delete', 'deleting', 'deleted', 'error')`);
        await queryRunner.query(`CREATE TABLE "volume" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizationId" uuid, "name" character varying NOT NULL, "state" "public"."volume_state_enum" NOT NULL DEFAULT 'pending_create', "errorReason" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "lastUsedAt" TIMESTAMP, CONSTRAINT "volume_organizationId_name_unique" UNIQUE ("organizationId", "name"), CONSTRAINT "volume_id_pk" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."sandbox_region_enum" AS ENUM('eu', 'us', 'asia')`);
        await queryRunner.query(`CREATE TYPE "public"."sandbox_class_enum" AS ENUM('small', 'medium', 'large')`);
        await queryRunner.query(`CREATE TYPE "public"."sandbox_state_enum" AS ENUM('creating', 'restoring', 'destroyed', 'destroying', 'started', 'stopped', 'starting', 'stopping', 'error', 'build_failed', 'pending_build', 'building_snapshot', 'unknown', 'pulling_snapshot', 'archiving', 'archived')`);
        await queryRunner.query(`CREATE TYPE "public"."sandbox_desiredstate_enum" AS ENUM('destroyed', 'started', 'stopped', 'resized', 'archived')`);
        await queryRunner.query(`CREATE TYPE "public"."sandbox_backupstate_enum" AS ENUM('None', 'Pending', 'InProgress', 'Completed', 'Error')`);
        await queryRunner.query(`CREATE TABLE "sandbox" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizationId" uuid NOT NULL, "region" "public"."sandbox_region_enum" NOT NULL DEFAULT 'eu', "runnerId" uuid, "prevRunnerId" uuid, "class" "public"."sandbox_class_enum" NOT NULL DEFAULT 'small', "state" "public"."sandbox_state_enum" NOT NULL DEFAULT 'unknown', "desiredState" "public"."sandbox_desiredstate_enum" NOT NULL DEFAULT 'started', "snapshot" character varying, "osUser" character varying NOT NULL, "errorReason" character varying, "env" jsonb NOT NULL DEFAULT '{}', "public" boolean NOT NULL DEFAULT false, "labels" jsonb, "backupRegistryId" character varying, "backupSnapshot" character varying, "lastBackupAt" TIMESTAMP, "backupState" "public"."sandbox_backupstate_enum" NOT NULL DEFAULT 'None', "existingBackupSnapshots" jsonb NOT NULL DEFAULT '[]', "cpu" integer NOT NULL DEFAULT '2', "gpu" integer NOT NULL DEFAULT '0', "mem" integer NOT NULL DEFAULT '4', "disk" integer NOT NULL DEFAULT '10', "volumes" jsonb NOT NULL DEFAULT '[]', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "lastActivityAt" TIMESTAMP, "autoStopInterval" integer NOT NULL DEFAULT '15', "autoArchiveInterval" integer NOT NULL DEFAULT '10080', "pending" boolean NOT NULL DEFAULT false, "authToken" character varying NOT NULL DEFAULT MD5(random()::text), "daemonVersion" character varying, "buildInfoSnapshotRef" character varying, CONSTRAINT "sandbox_id_pk" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "build_info" ("snapshotRef" character varying NOT NULL, "dockerfileContent" text, "contextHashes" text, "lastUsedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "build_info_snapshotRef_pk" PRIMARY KEY ("snapshotRef"))`);
        await queryRunner.query(`CREATE TYPE "public"."snapshot_runner_state_enum" AS ENUM('pulling_snapshot', 'building_snapshot', 'ready', 'error', 'removing')`);
        await queryRunner.query(`CREATE TABLE "snapshot_runner" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "state" "public"."snapshot_runner_state_enum" NOT NULL DEFAULT 'pulling_snapshot', "errorReason" character varying, "snapshotRef" character varying NOT NULL DEFAULT '', "runnerId" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "snapshot_runner_id_pk" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."snapshot_state_enum" AS ENUM('build_pending', 'building', 'pending', 'pulling', 'pending_validation', 'validating', 'active', 'inactive', 'error', 'build_failed', 'removing')`);
        await queryRunner.query(`CREATE TABLE "snapshot" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizationId" uuid, "general" boolean NOT NULL DEFAULT false, "name" character varying NOT NULL, "imageName" character varying NOT NULL, "internalName" character varying, "enabled" boolean NOT NULL DEFAULT true, "state" "public"."snapshot_state_enum" NOT NULL DEFAULT 'pending', "errorReason" character varying, "size" double precision, "cpu" integer NOT NULL DEFAULT '1', "gpu" integer NOT NULL DEFAULT '0', "mem" integer NOT NULL DEFAULT '1', "disk" integer NOT NULL DEFAULT '3', "hideFromUsers" boolean NOT NULL DEFAULT false, "entrypoint" text array, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "lastUsedAt" TIMESTAMP, "buildRunnerId" character varying, "buildInfoSnapshotRef" character varying, CONSTRAINT "snapshot_organizationId_name_unique" UNIQUE ("organizationId", "name"), CONSTRAINT "snapshot_id_pk" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."runner_class_enum" AS ENUM('small', 'medium', 'large')`);
        await queryRunner.query(`CREATE TYPE "public"."runner_region_enum" AS ENUM('eu', 'us', 'asia')`);
        await queryRunner.query(`CREATE TYPE "public"."runner_state_enum" AS ENUM('initializing', 'ready', 'disabled', 'decommissioned', 'unresponsive')`);
        await queryRunner.query(`CREATE TABLE "runner" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "domain" character varying NOT NULL, "apiUrl" character varying NOT NULL, "apiKey" character varying NOT NULL, "cpu" integer NOT NULL, "memory" integer NOT NULL, "disk" integer NOT NULL, "gpu" integer NOT NULL, "gpuType" character varying NOT NULL, "class" "public"."runner_class_enum" NOT NULL DEFAULT 'small', "used" integer NOT NULL DEFAULT '0', "capacity" integer NOT NULL, "region" "public"."runner_region_enum" NOT NULL, "state" "public"."runner_state_enum" NOT NULL DEFAULT 'initializing', "lastChecked" TIMESTAMP, "unschedulable" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "runner_domain_unique" UNIQUE ("domain"), CONSTRAINT "runner_id_pk" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."docker_registry_registrytype_enum" AS ENUM('internal', 'organization', 'public', 'transient')`);
        await queryRunner.query(`CREATE TABLE "docker_registry" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "url" character varying NOT NULL, "username" character varying NOT NULL, "password" character varying NOT NULL, "isDefault" boolean NOT NULL DEFAULT false, "project" character varying NOT NULL, "organizationId" uuid, "registryType" "public"."docker_registry_registrytype_enum" NOT NULL DEFAULT 'internal', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "docker_registry_id_pk" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "sandbox" ADD CONSTRAINT "sandbox_buildInfoSnapshotRef_fk" FOREIGN KEY ("buildInfoSnapshotRef") REFERENCES "build_info"("snapshotRef") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "snapshot" ADD CONSTRAINT "snapshot_buildInfoSnapshotRef_fk" FOREIGN KEY ("buildInfoSnapshotRef") REFERENCES "build_info"("snapshotRef") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "snapshot" DROP CONSTRAINT "snapshot_buildInfoSnapshotRef_fk"`);
        await queryRunner.query(`ALTER TABLE "sandbox" DROP CONSTRAINT "sandbox_buildInfoSnapshotRef_fk"`);
        await queryRunner.query(`DROP TABLE "docker_registry"`);
        await queryRunner.query(`DROP TYPE "public"."docker_registry_registrytype_enum"`);
        await queryRunner.query(`DROP TABLE "runner"`);
        await queryRunner.query(`DROP TYPE "public"."runner_state_enum"`);
        await queryRunner.query(`DROP TYPE "public"."runner_region_enum"`);
        await queryRunner.query(`DROP TYPE "public"."runner_class_enum"`);
        await queryRunner.query(`DROP TABLE "snapshot"`);
        await queryRunner.query(`DROP TYPE "public"."snapshot_state_enum"`);
        await queryRunner.query(`DROP TABLE "snapshot_runner"`);
        await queryRunner.query(`DROP TYPE "public"."snapshot_runner_state_enum"`);
        await queryRunner.query(`DROP TABLE "build_info"`);
        await queryRunner.query(`DROP TABLE "sandbox"`);
        await queryRunner.query(`DROP TYPE "public"."sandbox_backupstate_enum"`);
        await queryRunner.query(`DROP TYPE "public"."sandbox_desiredstate_enum"`);
        await queryRunner.query(`DROP TYPE "public"."sandbox_state_enum"`);
        await queryRunner.query(`DROP TYPE "public"."sandbox_class_enum"`);
        await queryRunner.query(`DROP TYPE "public"."sandbox_region_enum"`);
        await queryRunner.query(`DROP TABLE "volume"`);
        await queryRunner.query(`DROP TYPE "public"."volume_state_enum"`);
        await queryRunner.query(`DROP TABLE "warm_pool"`);
        await queryRunner.query(`DROP TYPE "public"."warm_pool_class_enum"`);
        await queryRunner.query(`DROP TYPE "public"."warm_pool_target_enum"`);
        await queryRunner.query(`DROP TABLE "sandbox_usage_periods"`);
    }

}
