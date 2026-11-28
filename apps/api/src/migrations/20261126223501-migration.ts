import { Migration } from '@mikro-orm/migrations';

export class Migration20261126223501 extends Migration {

  override name = 'Migration20261126223501';

  override up(): void | Promise<void> {
    this.addSql(`create type "job_status_enum" as enum ('pending', 'in_progress', 'completed', 'failed');`);
    this.addSql(`create type "job_resourcetype_enum" as enum ('sandbox', 'snapshot', 'backup', 'volume', 'machine');`);
    this.addSql(`create type "job_projection_status_enum" as enum ('not_required', 'pending', 'processing', 'applied', 'failed');`);
    this.addSql(`create type "machine_snapshot_target_reason_enum" as enum ('propagation', 'build_cache', 'prewarm');`);
    this.addSql(`create type "snapshot_machine_state_enum" as enum ('present', 'pulling', 'failed');`);
    this.addSql(`create type "user_role_enum" as enum ('admin', 'user');`);
    this.addSql(`create type "snapshot_state_enum" as enum ('building', 'capturing', 'pending', 'pulling', 'active', 'inactive', 'error', 'build_failed', 'removing');`);
    this.addSql(`create type "continent_enum" as enum ('africa', 'asia', 'europe', 'north-america', 'oceania', 'south-america');`);
    this.addSql(`create type "machine_state_enum" as enum ('initializing', 'ready', 'draining', 'failed', 'disabled', 'decommissioned', 'unresponsive');`);
    this.addSql(`create type "docker_registry_registrytype_enum" as enum ('internal', 'organization', 'transient', 'backup');`);
    this.addSql(`create type "sandbox_mode_enum" as enum ('ephemeral', 'standard');`);
    this.addSql(`create type "sandbox_state_enum" as enum ('creating', 'restoring', 'destroyed', 'destroying', 'started', 'stopped', 'starting', 'stopping', 'error', 'build_failed', 'pending_build', 'pending_placement', 'building_snapshot', 'unknown', 'archived', 'archiving', 'resizing', 'snapshotting', 'forking', 'pausing', 'paused', 'resuming', 'machine_unavailable');`);
    this.addSql(`create type "sandbox_desiredstate_enum" as enum ('destroyed', 'started', 'stopped', 'resized', 'archived', 'paused');`);
    this.addSql(`create type "sandbox_backupstate_enum" as enum ('none', 'pending', 'in_progress', 'completed', 'error');`);
    this.addSql(`create type "volume_backup_state_enum" as enum ('none', 'pending', 'completed', 'error');`);
    this.addSql(`create type "volume_state_enum" as enum ('ready', 'pending_delete', 'deleting', 'resizing', 'restoring', 'deleted', 'error');`);
    this.addSql(`create table "abuse_hostname" ("id" uuid not null default gen_random_uuid(), "hostname" varchar not null, "kind" varchar not null, "sandboxId" varchar not null, "organizationId" uuid not null, "exposureId" uuid null, "assignedAt" timestamptz(3) not null, "releasedAt" timestamptz(3) null, constraint "abuse_hostname_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_abuse_hostname_sandbox" on "abuse_hostname" ("sandboxId");`);
    this.addSql(`alter table "abuse_hostname" add constraint "UQ_abuse_hostname_assignment" unique ("hostname", "sandboxId");`);

    this.addSql(`create table "api_idempotency_record" ("id" uuid not null default gen_random_uuid(), "organizationId" uuid not null, "principalType" varchar not null, "principalId" varchar not null, "method" varchar(16) not null, "routeTemplate" varchar(512) not null, "keyDigest" varchar not null, "requestFingerprint" varchar not null, "fingerprintSchemaVersion" smallint not null, "state" varchar not null, "resourceType" varchar(128) null, "resourceId" varchar null, "responseStatus" smallint null, "responseHeaders" jsonb null, "responseBody" jsonb null, "sensitiveResponseEnvelope" text null, "terminalProblem" jsonb null, "completedAt" timestamptz(3) null, "expiresAt" timestamptz(3) not null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "api_idempotency_record_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_api_idempotency_expiry" on "api_idempotency_record" ("expiresAt");`);
    this.addSql(`create unique index "UQ_api_idempotency_request" on "api_idempotency_record" ("organizationId", "principalType", "principalId", "method", "routeTemplate", "keyDigest");`);

    this.addSql(`create table "audit_log" ("id" uuid not null default gen_random_uuid(), "actorId" varchar not null, "actorType" varchar not null, "actorDisplayName" varchar null, "actorEmail" varchar null, "credentialType" varchar not null, "credentialId" varchar null, "organizationId" uuid null, "userId" uuid null, "action" varchar not null, "targetType" varchar null, "targetId" varchar null, "statusCode" integer null, "errorMessage" varchar null, "ipAddress" varchar null, "userAgent" text null, "source" varchar null, "metadata" jsonb null, "createdAt" timestamptz(3) not null default now(), constraint "audit_log_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_audit_log_dangling" on "audit_log" ("createdAt", "id") where "statusCode" is null;`);
    this.addSql(`create index "audit_log_organizationId_createdAt_index" on "audit_log" ("organizationId", "createdAt", "id");`);
    this.addSql(`create index "audit_log_createdAt_index" on "audit_log" ("createdAt", "id");`);

    this.addSql(`create table "billing_ledger_account" ("id" uuid not null default gen_random_uuid(), "ownerKind" varchar not null, "ownerReference" varchar not null, "accountCode" varchar not null, "currency" varchar not null default 'USD', "createdAt" timestamptz(3) not null default now(), constraint "billing_ledger_account_id_pk" primary key ("id"));`);
    this.addSql(`create unique index "IDX_billing_ledger_account_owner" on "billing_ledger_account" ("ownerKind", "ownerReference", "accountCode", "currency");`);

    this.addSql(`create table "billing_ledger_transaction" ("id" uuid not null default gen_random_uuid(), "sourceType" varchar not null, "sourceReference" varchar not null, "sourceVersion" integer not null, "postingHash" varchar(64) not null, "descriptionCode" varchar not null, "effectiveAt" timestamptz(3) not null, "postedAt" timestamptz(3) not null, "metadata" jsonb not null default '{}', "createdAt" timestamptz(3) not null default now(), constraint "billing_ledger_transaction_id_pk" primary key ("id"));`);
    this.addSql(`create unique index "IDX_billing_ledger_transaction_source" on "billing_ledger_transaction" ("sourceType", "sourceReference", "sourceVersion");`);

    this.addSql(`create table "billing_ledger_entry" ("id" uuid not null default gen_random_uuid(), "transactionId" uuid not null, "entryNumber" integer not null, "accountId" uuid not null, "side" varchar not null, "amount" numeric(40,0) not null, "createdAt" timestamptz(3) not null default now(), constraint "billing_ledger_entry_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_billing_ledger_entry_account" on "billing_ledger_entry" ("accountId", "createdAt");`);
    this.addSql(`create unique index "IDX_billing_ledger_entry_transaction" on "billing_ledger_entry" ("transactionId", "entryNumber");`);

    this.addSql(`create table "build_info" ("snapshotRef" varchar not null, "dockerfileContent" text null, "contextHashes" text null, "lastUsedAt" timestamptz(3) not null default CURRENT_TIMESTAMP, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "build_info_snapshotRef_pk" primary key ("snapshotRef"));`);

    this.addSql(`create table "network_edge" ("id" uuid not null default gen_random_uuid(), "name" varchar(64) not null, "status" varchar not null default 'enrolling', "identityPublicKey" text null, "identityKeyId" varchar(128) null, "identityKeyRegisteredAt" timestamptz(3) null, "enrollmentSecretHash" varchar(64) null, "enrollmentSecretExpiresAt" timestamptz(3) null, "enrollmentCompletedAt" timestamptz(3) null, "credentialGeneration" integer not null default 1, "publicHost" varchar(253) not null, "tunnelAddress" jsonb not null, "publicAddresses" jsonb not null, "portInventory" jsonb not null, "capacityProfile" jsonb not null, "supportedProtocols" text[] not null, "routeTableVersion" bigint not null default 0, "routeTableGeneratedAt" timestamptz(3) not null default CURRENT_TIMESTAMP, "routeTablePublishedVersion" bigint null, "routeTablePublishedDigest" char(64) null, "sessionGeneration" integer not null default 0, "usageEpoch" integer not null default 0, "sessionExpiresAt" timestamptz(3) null, "lastHeartbeatAt" timestamptz(3) null, "lastStartedAt" timestamptz(3) null, "lastReportedVersion" varchar(128) null, "lastReportedRouteTableVersion" varchar(128) null, "observedCapacity" jsonb null, "reachabilityConfirmedAt" timestamptz(3) null, "lastFailureAt" timestamptz(3) null, "lastFailureReason" varchar(1000) null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "network_edge_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_network_edge_control_refresh" on "network_edge" ("routeTableGeneratedAt", "id") where "sessionExpiresAt" is not null;`);
    this.addSql(`create index "IDX_network_edge_created" on "network_edge" ("createdAt", "id");`);
    this.addSql(`create index "IDX_network_edge_status" on "network_edge" ("status");`);
    this.addSql(`create unique index "IDX_network_edge_identity_key" on "network_edge" ("identityKeyId") where "identityKeyId" is not null;`);
    this.addSql(`alter table "network_edge" add constraint "UQ_network_edge_name" unique ("name");`);

    this.addSql(`create table "network_edge_session" ("id" uuid not null default gen_random_uuid(), "edgeId" uuid not null, "generation" integer not null, "tokenHash" varchar(64) not null, "proofNonce" varchar(128) not null, "proofIssuedAt" timestamptz(3) not null, "expiresAt" timestamptz(3) not null, "replacementGraceExpiresAt" timestamptz(3) null, "revokedAt" timestamptz(3) null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "network_edge_session_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_network_edge_session_expiry" on "network_edge_session" ("expiresAt");`);
    this.addSql(`alter table "network_edge_session" add constraint "UQ_network_edge_session_proof_nonce" unique ("edgeId", "proofNonce");`);
    this.addSql(`alter table "network_edge_session" add constraint "UQ_network_edge_session_generation" unique ("edgeId", "generation");`);

    this.addSql(`create table "edge_usage_checkpoint" ("id" uuid not null default gen_random_uuid(), "edgeId" uuid not null, "usageEpoch" integer not null, "sequence" bigint not null, "previousDigest" char(64) null, "digest" char(64) not null, "edgeSessionGeneration" integer not null, "intervalStartedAt" timestamptz(3) not null, "intervalEndedAt" timestamptz(3) not null, "payload" jsonb not null, "signature" text not null, "signerPublicKey" text not null, "acceptedAt" timestamptz(3) not null default now(), constraint "edge_usage_checkpoint_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_edge_usage_checkpoint_interval" on "edge_usage_checkpoint" ("intervalEndedAt");`);
    this.addSql(`alter table "edge_usage_checkpoint" add constraint "UQ_edge_usage_checkpoint_digest" unique ("edgeId", "digest");`);
    this.addSql(`alter table "edge_usage_checkpoint" add constraint "UQ_edge_usage_checkpoint_epoch_sequence" unique ("edgeId", "usageEpoch", "sequence");`);

    this.addSql(`create table "escrow_account" ("id" uuid not null default gen_random_uuid(), "chainId" integer not null, "contractAddress" varchar(42) not null, "address" varchar(42) not null, "freeMicroUsd" numeric(40,0) not null, "pendingMicroUsd" numeric(40,0) not null, "withdrawalUnlockAt" timestamptz(3) null, "hostBalanceMicroUsd" numeric(40,0) not null, "hostWithdrawnMicroUsd" numeric(40,0) not null, "feesAccruedMicroUsd" numeric(40,0) not null, "frozenMicroUsd" numeric(40,0) not null, "blockedAt" timestamptz(3) null, "blockedUntil" timestamptz(3) null, "blockReason" varchar null, "payoutAddress" varchar(42) null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "escrow_account_id_pk" primary key ("id"));`);
    this.addSql(`alter table "escrow_account" add constraint "UQ_escrow_account_address" unique ("chainId", "contractAddress", "address");`);

    this.addSql(`create table "escrow_auto_top_up" ("id" uuid not null default gen_random_uuid(), "chainId" integer not null, "contractAddress" varchar(42) not null, "customerAddress" varchar(42) not null, "relayerAddress" varchar(42) not null, "amountMicroUsd" numeric(40,0) not null, "thresholdMicroUsd" numeric(40,0) not null, "maxRelayFeeMicroUsd" numeric(40,0) not null, "minIntervalSeconds" integer not null, "lastTopUpAt" timestamptz(3) null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "escrow_auto_top_up_id_pk" primary key ("id"));`);
    this.addSql(`alter table "escrow_auto_top_up" add constraint "UQ_escrow_auto_top_up_customer" unique ("chainId", "contractAddress", "customerAddress");`);

    this.addSql(`create table "escrow_claims_freeze" ("chainId" integer not null, "contractAddress" varchar(42) not null, "frozenSince" timestamptz(3) not null, "frozenUntil" timestamptz(3) not null, "accumulatedSeconds" integer not null, "updatedAt" timestamptz(3) not null default now(), constraint "escrow_claims_freeze_chainId_contractAddress_pk" primary key ("chainId", "contractAddress"));`);

    this.addSql(`create table "escrow_signer" ("id" uuid not null default gen_random_uuid(), "chainId" integer not null, "contractAddress" varchar(42) not null, "signerAddress" varchar(42) not null, "customerAddress" varchar(42) not null, "hourlyCap" numeric(40,0) not null, "pendingHourlyCap" numeric(40,0) not null, "pendingEffectiveAt" timestamptz(3) null, "available" numeric(40,0) not null, "remainder" integer not null, "budgetUpdatedAt" timestamptz(3) not null, "expiresAt" timestamptz(3) not null, "maxFeeBps" integer not null, "hostAddress" varchar(42) null, "thawEndsAt" timestamptz(3) null, "revokedAt" timestamptz(3) null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "escrow_signer_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_escrow_signer_customer" on "escrow_signer" ("customerAddress");`);
    this.addSql(`alter table "escrow_signer" add constraint "UQ_escrow_signer" unique ("chainId", "contractAddress", "signerAddress");`);

    this.addSql(`create table "job" ("id" uuid not null default gen_random_uuid(), "version" integer not null default 1, "type" varchar not null, "status" "job_status_enum" not null default 'pending', "machineId" uuid not null, "resourceType" "job_resourcetype_enum" not null, "resourceId" varchar not null, "assignmentGeneration" integer null, "payload" varchar null, "resultMetadata" varchar null, "executionResult" jsonb null, "availableAt" timestamptz(3) not null default CURRENT_TIMESTAMP, "attempt" integer not null default 0, "maxAttempts" integer not null default 3, "leaseToken" uuid null, "leaseExpiresAt" timestamptz(3) null, "leasedBySessionId" uuid null, "acceptedAttempt" integer null, "acceptedLeaseToken" uuid null, "acceptedSessionId" uuid null, "resultDigest" varchar(64) null, "projectionStatus" "job_projection_status_enum" not null default 'not_required', "projectedAt" timestamptz(3) null, "projectionClaimedAt" timestamptz(3) null, "projectionRetryAt" timestamptz(3) null, "projectionAttempts" integer not null default 0, "projectionError" text null, "traceContext" jsonb null, "errorMessage" text null, "startedAt" timestamptz(3) null, "completedAt" timestamptz(3) null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "job_id_pk" primary key ("id"));`);
    this.addSql(`create index "job_resourceType_resourceId_index" on "job" ("resourceType", "resourceId");`);
    this.addSql(`create index "job_status_createdAt_index" on "job" ("status", "createdAt");`);
    this.addSql(`create index "IDX_job_projection_status_completed" on "job" ("projectionStatus", "completedAt");`);
    this.addSql(`create index "IDX_job_status_lease_expiry" on "job" ("status", "leaseExpiresAt");`);
    this.addSql(`create index "IDX_job_machine_status_available" on "job" ("machineId", "status", "availableAt");`);
    this.addSql(`create index "IDX_job_machine_status_created" on "job" ("machineId", "status", "createdAt", "id");`);
    this.addSql(`create index "job_machineId_status_index" on "job" ("machineId", "status");`);
    this.addSql(`create unique index "IDX_UNIQUE_INCOMPLETE_BACKUP_JOB" on "job" ("resourceType", "resourceId", "machineId") where "completedAt" is null and "type" in ('create_backup', 'backup_volumes');`);
    this.addSql(`create unique index "IDX_UNIQUE_INCOMPLETE_JOB" on "job" ("resourceType", "resourceId", "machineId") where "completedAt" is null and "type" not in ('create_backup', 'backup_volumes');`);

    this.addSql(`create table "machine_snapshot_target" ("id" uuid not null default gen_random_uuid(), "machineId" uuid not null, "snapshotRef" varchar not null, "reason" "machine_snapshot_target_reason_enum" not null, "template" jsonb null, "createdAt" timestamptz(3) not null default now(), constraint "machine_snapshot_target_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_machine_snapshot_target_snapshot" on "machine_snapshot_target" ("snapshotRef", "reason", "createdAt");`);
    this.addSql(`alter table "machine_snapshot_target" add constraint "machine_snapshot_target_unique" unique ("machineId", "snapshotRef", "reason");`);

    this.addSql(`create table "machine_workload_outcome" ("subjectKind" varchar(16) not null, "subject" varchar(71) not null, "host" varchar not null, "outcomeClass" varchar(16) not null, "lastObservedAt" timestamptz(3) not null, constraint "machine_workload_outcome_subjectKind_subject_hos_eac87_pkey" primary key ("subjectKind", "subject", "host", "outcomeClass"));`);
    this.addSql(`create index "IDX_machine_workload_outcome_observed" on "machine_workload_outcome" ("lastObservedAt");`);

    this.addSql(`create table "realtime_outbox_deduplication" ("deduplicationKey" varchar not null, "createdAt" timestamptz(3) not null default now(), constraint "realtime_outbox_deduplication_deduplicationKey_pk" primary key ("deduplicationKey"));`);

    this.addSql(`create table "realtime_outbox_event" ("id" uuid not null, "topic" varchar not null, "aggregateId" uuid not null, "payload" jsonb not null, "deduplicationKey" varchar not null, "status" varchar not null default 'pending', "attempts" integer not null default 0, "availableAt" timestamptz(3) not null, "lockId" uuid null, "lockedUntil" timestamptz(3) null, "publishedAt" timestamptz(3) null, "lastError" text null, "createdAt" timestamptz(3) not null, "updatedAt" timestamptz(3) not null, constraint "realtime_outbox_event_id_pk" primary key ("id"));`);
    this.addSql(`create index "realtime_outbox_event_dispatch_index" on "realtime_outbox_event" ("status", "availableAt", "createdAt");`);
    this.addSql(`alter table "realtime_outbox_event" add constraint "realtime_outbox_event_deduplication_key_unique" unique ("deduplicationKey");`);

    this.addSql(`create table "sanctioned_address" ("address" varchar(42) not null, "sdnEntryUid" integer not null, "entityName" text not null, "currency" varchar not null, "listedAt" timestamptz(3) not null, constraint "sanctioned_address_address_pk" primary key ("address"));`);

    this.addSql(`create table "sanctions_list_sync" ("id" smallint not null default 1, "publishedAt" timestamptz(3) not null, "recordCount" integer not null, "addressCount" integer not null, "syncedAt" timestamptz(3) not null, constraint "sanctions_list_sync_id_pk" primary key ("id"));`);

    this.addSql(`create table "sanctions_pending_alert" ("id" uuid not null default gen_random_uuid(), "kind" varchar not null, "paymentWalletId" uuid not null, "organizationId" uuid not null, "purpose" varchar not null, "address" varchar(42) not null, "createdAt" timestamptz(3) not null default now(), constraint "sanctions_pending_alert_id_pk" primary key ("id"));`);

    this.addSql(`create table "sandbox_connection_record" ("id" uuid not null default gen_random_uuid(), "workloadId" varchar not null, "workloadKind" varchar not null, "organizationId" uuid not null, "machineId" uuid not null, "destinationAddress" varchar not null, "destinationPort" integer not null, "protocol" varchar not null, "bucketStart" timestamptz(3) not null, "firstSeenAt" timestamptz(3) not null, "lastSeenAt" timestamptz(3) not null, constraint "sandbox_connection_record_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_sandbox_connection_record_bucket" on "sandbox_connection_record" ("bucketStart");`);
    this.addSql(`create index "IDX_sandbox_connection_record_destination" on "sandbox_connection_record" ("destinationAddress", "bucketStart");`);
    this.addSql(`alter table "sandbox_connection_record" add constraint "UQ_sandbox_connection_record_flow" unique ("workloadId", "destinationAddress", "destinationPort", "protocol", "bucketStart");`);

    this.addSql(`create table "settlement_chain_cursor" ("chainId" integer not null, "contractAddress" varchar(42) not null, "lastIndexedBlock" bigint not null, "updatedAt" timestamptz(3) not null default now(), constraint "settlement_chain_cursor_chainId_contractAddress_pk" primary key ("chainId", "contractAddress"));`);

    this.addSql(`create table "snapshot_machine" ("id" uuid not null default gen_random_uuid(), "machineId" uuid not null, "snapshotRef" varchar not null, "state" "snapshot_machine_state_enum" not null, "digest" varchar null, "sizeBytes" bigint not null default '0', "errorReason" varchar null, "preparedTemplate" jsonb null, "observedAt" timestamptz(3) not null, constraint "snapshot_machine_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_snapshot_machine_snapshot_state" on "snapshot_machine" ("snapshotRef", "state");`);
    this.addSql(`alter table "snapshot_machine" add constraint "snapshot_machine_machineid_snapshotref_unique" unique ("machineId", "snapshotRef");`);

    this.addSql(`create table "unmet_demand" ("id" uuid not null default gen_random_uuid(), "deduplicationKey" varchar not null, "organizationId" uuid not null, "priceClass" varchar not null, "continent" varchar null, "cpu" double precision not null, "memoryGiB" double precision not null, "gpu" integer not null, "wholeMachine" boolean not null, "createdAt" timestamptz(3) not null default now(), constraint "unmet_demand_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_unmet_demand_recent" on "unmet_demand" ("createdAt", "priceClass");`);
    this.addSql(`alter table "unmet_demand" add constraint "UQ_unmet_demand_deduplication" unique ("deduplicationKey");`);

    this.addSql(`create table "user" ("id" uuid not null, "name" varchar not null, "email" varchar not null default '', "emailVerified" boolean not null default false, "keyPair" text null, "publicKeys" text not null default '[]', "twoFactorEnabled" boolean not null default false, "image" text null, "role" "user_role_enum" not null default 'user', "restrictedEvidenceAccess" boolean not null default false, "banned" boolean not null default false, "banReason" text null, "banExpires" timestamptz(3) null, "bannedAt" timestamptz(3) null, "lastActiveOrganizationId" uuid null, "acceptedTermsVersion" varchar null, "termsAcceptedAt" timestamptz(3) null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "user_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_user_name" on "user" ("name", "id");`);
    this.addSql(`create index "IDX_user_created" on "user" ("createdAt", "id");`);
    this.addSql(`alter table "user" add constraint "user_email_unique" unique ("email");`);

    this.addSql(`create table "twoFactor" ("id" uuid not null default gen_random_uuid(), "secret" text not null, "backupCodes" text not null, "verified" boolean not null default true, "failedVerificationCount" integer not null default 0, "lockedUntil" timestamptz(3) null, "userId" uuid not null, constraint "twoFactor_id_pk" primary key ("id"));`);
    this.addSql(`create index "two_factor_secret_index" on "twoFactor" ("secret");`);
    this.addSql(`create unique index "two_factor_user_id_index" on "twoFactor" ("userId");`);

    this.addSql(`create table "session" ("id" uuid not null default gen_random_uuid(), "token" varchar not null, "expiresAt" timestamptz(3) not null, "ipAddress" text null, "userAgent" text null, "impersonatedBy" varchar null, "secondFactorVerifiedAt" timestamptz(3) null, "activeOrganizationId" uuid null, "userId" uuid not null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "session_id_pk" primary key ("id"));`);
    this.addSql(`create index "session_impersonated_by_index" on "session" ("impersonatedBy");`);
    this.addSql(`create index "session_active_organization_id_index" on "session" ("activeOrganizationId");`);
    this.addSql(`create index "session_user_id_index" on "session" ("userId");`);
    this.addSql(`create index "session_expires_at_index" on "session" ("expiresAt");`);
    this.addSql(`alter table "session" add constraint "session_token_unique" unique ("token");`);

    this.addSql(`create table "passkey" ("id" uuid not null default gen_random_uuid(), "name" text null, "publicKey" text not null, "credentialID" text not null, "counter" integer not null, "deviceType" text not null, "backedUp" boolean not null, "transports" text null, "createdAt" timestamptz(3) not null default now(), "aaguid" text null, "userId" uuid not null, constraint "passkey_id_pk" primary key ("id"));`);
    this.addSql(`create index "passkey_user_id_index" on "passkey" ("userId");`);
    this.addSql(`create unique index "passkey_credential_id_index" on "passkey" ("credentialID");`);

    this.addSql(`create table "organization" ("id" uuid not null, "name" varchar not null, "slug" varchar not null, "logo" text null, "metadata" text null, "personal" boolean not null default false, "createdBy" uuid null, "telemetryEnabled" boolean not null default true, "suspended" boolean not null default false, "suspendedAt" timestamptz(3) null, "suspensionReason" varchar null, "suspendedUntil" timestamptz(3) null, "suspensionCleanupGracePeriodHours" integer not null default 24, "quotaTier" integer not null default 0, "quotaTierChangedAt" timestamptz(3) null, "deletedAt" timestamptz(3) null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "organization_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_organization_name" on "organization" ("name", "id");`);
    this.addSql(`create index "IDX_organization_created" on "organization" ("createdAt", "id");`);
    this.addSql(`create unique index "UQ_organization_personal_owner" on "organization" ("createdBy") where "personal" = true and "deletedAt" is null;`);
    this.addSql(`alter table "organization" add constraint "organization_slug_unique" unique ("slug");`);

    this.addSql(`create table "storage_charge" ("id" uuid not null default gen_random_uuid(), "organizationId" uuid not null, "serviceHour" timestamptz(3) not null, "storedBytes" bigint not null, "amountMicroUsd" numeric(40,0) not null, "createdAt" timestamptz(3) not null default now(), constraint "storage_charge_id_pk" primary key ("id"));`);
    this.addSql(`alter table "storage_charge" add constraint "UQ_storage_charge_organization_hour" unique ("organizationId", "serviceHour");`);

    this.addSql(`create table "snapshot" ("id" uuid not null default gen_random_uuid(), "organizationId" uuid null, "general" boolean not null default false, "name" varchar not null, "imageName" varchar not null default '', "ref" varchar null, "digest" varchar null, "state" "snapshot_state_enum" not null default 'pending', "errorReason" varchar null, "size" double precision null, "cpu" integer not null default 2, "gpu" integer not null default 0, "gpu_type" varchar null, "mem" integer not null default 4, "disk" integer not null default 10, "hideFromUsers" boolean not null default false, "sandboxClass" varchar not null default 'linux_vm', "entrypoint" text[] null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), "lastUsedAt" timestamp(3) null, "buildInfoSnapshotRef" varchar null, "initialMachineId" varchar null, constraint "snapshot_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_snapshot_organization_last_used" on "snapshot" ("organizationId", general, "lastUsedAt" desc nulls last, "createdAt" desc, id desc);`);
    this.addSql(`create index "IDX_snapshot_organization_created" on "snapshot" ("organizationId", "general", "createdAt", "id");`);
    this.addSql(`create index "IDX_snapshot_state_updated" on "snapshot" ("state", "updatedAt", "id");`);
    this.addSql(`create index "snapshot_state_idx" on "snapshot" ("state");`);
    this.addSql(`create index "snapshot_name_idx" on "snapshot" ("name");`);
    this.addSql(`alter table "snapshot" add constraint "UQ_snapshot_organization_name" unique ("organizationId", "name");`);

    this.addSql(`create table "settings" ("id" smallint not null default 1, "defaultSnapshot" varchar null, "defaultSandboxClass" varchar not null, "sandboxDefaultLimitedNetworkEgress" boolean not null, "maxCpuPerSandbox" integer not null, "maxMemoryPerSandbox" integer not null, "maxDiskPerSandbox" integer not null, "machineGuestRegistryUrl" varchar null, "machineDesktopEnabled" boolean not null, "machineSerialConsoleEnabled" boolean not null, "minimumMachineReleaseVersion" varchar null, "publicIngressEnabled" boolean not null, "markupBasisPoints" integer not null, "priceLockDays" integer not null, "startWaitMinutes" integer not null, "exposureCeilingProbationaryCents" integer not null, "exposureCeilingEstablishedCents" integer not null, "exposureCeilingHostCents" integer not null, "listingMinimumDownlinkMbps" integer not null, "listingMinimumUplinkMbps" integer not null, "listingMinimumDiskRandomReadIops" integer not null, "listingMinimumDiskSequentialMibps" integer not null, "verifiedMinimumListedDays" integer not null, "verifiedMinimumUptimeBasisPoints" integer not null, "verifiedMinimumSpotChecks" integer not null, "spotCheckIntervalHoursCommunity" integer not null, "spotCheckIntervalHoursVerified" integer not null, "spotCheckMonthlyBudgetCents" integer not null, "spotCheckToleranceBasisPoints" integer not null, "spotCheckOrganizationId" uuid null, "settlementConfirmations" integer not null, "largeDepositConfirmations" integer not null, "largeDepositThresholdCents" integer not null, "voucherIntervalSeconds" integer not null, "voucherGraceIntervals" integer not null, "hostPayoutMinimumCents" integer not null, "minimumDepositCents" integer not null, "delegatedSignerMinimumHourlyCapCents" integer not null, "fundsStopMarginMinutes" integer not null, "quotaTiers" jsonb not null, "relayFeeMarginBasisPoints" integer not null, "walletFeeCapBasisPoints" integer not null, "storageMicroUsdPerGibMonth" integer not null, "storageCapGibDefault" integer not null, "sandboxUploadBandwidthLimitMbps" integer not null, "sandboxDownloadBandwidthLimitMbps" integer not null, "sandboxBurstMib" integer not null, "sandboxPacketsPerSecondLimit" integer not null, "sandboxNewConnectionsPerSecond" integer not null, "sandboxMaxConnections" integer not null, "sandboxHostLinkShareBasisPoints" integer not null, "abuseEnforcementMode" varchar not null, "archiveAfterStoppedDaysDefault" integer not null, "archiveAfterMachineOfflineMinutes" integer not null, "edgeTrustedHttpProxyCidrs" text[] not null default '{}', "maintenanceMode" boolean not null, "drainingMode" varchar not null, "drainingForce" boolean not null, "resourceVersion" integer not null default 1, "updatedBy" uuid null, "updatedAt" timestamptz(3) not null default now(), constraint "settings_id_pk" primary key ("id"));`);

    this.addSql(`create table "secret" ("id" uuid not null default gen_random_uuid(), "organizationId" uuid not null, "name" varchar(128) not null, "normalizedName" varchar(128) not null, "description" text null, "currentVersion" integer not null default 1, "resourceVersion" integer not null default 1, "createdByPrincipalType" varchar not null, "createdByPrincipalId" varchar not null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "secret_id_pk" primary key ("id"));`);
    this.addSql(`create unique index "UQ_secret_id_organization" on "secret" ("id", "organizationId");`);
    this.addSql(`create unique index "UQ_secret_organization_normalized_name" on "secret" ("organizationId", "normalizedName");`);

    this.addSql(`create table "secret_version" ("id" uuid not null default gen_random_uuid(), "organizationId" uuid not null, "secretId" uuid not null, "version" integer not null, "envelopeFormatVersion" smallint not null, "keyEncryptionKeyId" varchar(128) not null, "encryptedEnvelope" text not null, "createdByPrincipalType" varchar not null, "createdByPrincipalId" varchar not null, "resourceVersion" integer not null default 1, "createdAt" timestamptz(3) not null default now(), "revokedAt" timestamptz(3) null, constraint "secret_version_id_pk" primary key ("id"));`);
    this.addSql(`create unique index "UQ_secret_version_identity" on "secret_version" ("id", "organizationId", "secretId");`);
    this.addSql(`create unique index "UQ_secret_version_number" on "secret_version" ("secretId", "version");`);

    this.addSql(`create table "payment_wallet" ("id" uuid not null default gen_random_uuid(), "organizationId" uuid not null, "purpose" varchar not null, "address" varchar(42) not null, "verifiedAt" timestamptz(3) not null, "sanctionsStatus" varchar not null, "sanctionsCheckedAt" timestamptz(3) null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "payment_wallet_id_pk" primary key ("id"));`);
    this.addSql(`alter table "payment_wallet" add constraint "UQ_payment_wallet_purpose_address" unique ("purpose", "address");`);
    this.addSql(`alter table "payment_wallet" add constraint "UQ_payment_wallet_organization_purpose" unique ("organizationId", "purpose");`);

    this.addSql(`create table "payment_channel" ("id" uuid not null default gen_random_uuid(), "chainId" integer not null, "contractAddress" varchar(42) not null, "channelId" varchar(66) not null, "kind" varchar not null, "customerOrganizationId" uuid not null, "hostOrganizationId" uuid null, "machineId" uuid null, "customerAddress" varchar(42) not null, "hostAddress" varchar(42) not null, "feeReceiverAddress" varchar(42) not null, "feeBps" integer not null, "salt" varchar(66) not null, "signingMode" varchar not null, "chargedMicroUsd" numeric(40,0) not null, "issuedMicroUsd" numeric(40,0) not null, "signedMicroUsd" numeric(40,0) not null, "claimedMicroUsd" numeric(40,0) not null, "refundedMicroUsd" numeric(40,0) not null, "coveredAt" timestamptz(3) not null, "nextIssueAt" timestamptz(3) null, "voucherError" varchar null, "lastClaimedAt" timestamptz(3) null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "payment_channel_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_payment_channel_issue_due" on "payment_channel" ("nextIssueAt") where "nextIssueAt" is not null;`);
    this.addSql(`create index "IDX_payment_channel_machine" on "payment_channel" ("machineId");`);
    this.addSql(`create index "IDX_payment_channel_host_address" on "payment_channel" ("chainId", "contractAddress", "hostAddress");`);
    this.addSql(`create index "IDX_payment_channel_customer_address" on "payment_channel" ("chainId", "contractAddress", "customerAddress");`);
    this.addSql(`create index "IDX_payment_channel_host" on "payment_channel" ("hostOrganizationId", "createdAt", "id");`);
    this.addSql(`create index "IDX_payment_channel_customer" on "payment_channel" ("customerOrganizationId", "createdAt", "id");`);
    this.addSql(`alter table "payment_channel" add constraint "UQ_payment_channel_channel" unique ("chainId", "contractAddress", "channelId");`);

    this.addSql(`create table "payment_voucher" ("id" uuid not null default gen_random_uuid(), "paymentChannelId" uuid not null, "sequence" integer not null, "cumulativeMicroUsd" numeric(40,0) not null, "timestamp" timestamptz(3) not null, "metadata" varchar(66) not null, "digest" varchar(66) not null, "signerAddress" varchar(42) null, "signature" text null, "signedAt" timestamptz(3) null, "createdAt" timestamptz(3) not null default now(), constraint "payment_voucher_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_payment_voucher_signer" on "payment_voucher" ("signerAddress", "paymentChannelId", "sequence");`);
    this.addSql(`alter table "payment_voucher" add constraint "UQ_payment_voucher_sequence" unique ("paymentChannelId", "sequence");`);

    this.addSql(`create table "payment_channel_refund" ("id" uuid not null default gen_random_uuid(), "paymentChannelId" uuid not null, "amountMicroUsd" numeric(40,0) not null, "transactionHash" varchar(66) not null, "refundedByUserId" uuid null, "refundedAt" timestamptz(3) not null default now(), constraint "payment_channel_refund_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_payment_channel_refund_channel" on "payment_channel_refund" ("paymentChannelId", "refundedAt");`);
    this.addSql(`alter table "payment_channel_refund" add constraint "UQ_payment_channel_refund_transaction_channel" unique ("transactionHash", "paymentChannelId");`);

    this.addSql(`create table "organizationRole" ("id" uuid not null, "organizationId" uuid not null, "role" varchar not null, "permission" text not null, "description" varchar null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) null, constraint "organizationRole_id_pk" primary key ("id"));`);
    this.addSql(`create index "organizationRole_role_index" on "organizationRole" ("role");`);
    this.addSql(`alter table "organizationRole" add constraint "organizationRole_organizationId_role_unique" unique ("organizationId", "role");`);

    this.addSql(`create table "organization_quota_increase_request" ("id" uuid not null default gen_random_uuid(), "organizationId" uuid not null, "sandboxClass" varchar not null, "requestedCpu" integer not null, "requestedMemory" integer not null, "requestedDisk" integer not null, "requestedGpu" integer not null, "useCase" text not null, "status" varchar not null default 'pending', "requestedBy" uuid null, "reviewedBy" uuid null, "reviewedAt" timestamptz(3) null, "decisionReason" text null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "organization_quota_increase_request_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_quota_increase_request_organization" on "organization_quota_increase_request" ("organizationId", "createdAt");`);
    this.addSql(`create index "IDX_quota_increase_request_queue" on "organization_quota_increase_request" ("status", "createdAt");`);
    this.addSql(`create unique index "UQ_quota_increase_request_pending" on "organization_quota_increase_request" ("organizationId", "sandboxClass") where "status" = 'pending';`);

    this.addSql(`create table "organization_quota" ("organizationId" uuid not null, "sandboxClass" varchar not null, "total_cpu_quota" integer null, "total_memory_quota" integer not null, "total_disk_quota" integer not null, "total_gpu_quota" integer not null default 0, "allowed_gpu_types" text[] null, "max_cpu_per_sandbox" integer null, "max_memory_per_sandbox" integer null, "max_disk_per_sandbox" integer null, "max_disk_per_non_ephemeral_sandbox" integer null, "max_cpu_per_gpu_sandbox" integer null default 16, "max_memory_per_gpu_sandbox" integer null default 192, "max_disk_per_gpu_sandbox" integer null default 512, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "organization_quota_organizationId_sandboxClass_pk" primary key ("organizationId", "sandboxClass"));`);

    this.addSql(`create table "organization_limits" ("organizationId" uuid not null, "max_cpu_per_sandbox" integer not null, "max_memory_per_sandbox" integer not null, "max_disk_per_sandbox" integer not null, "storage_cap_gib" integer null, "archiveAfterStoppedDays" integer null, "authenticated_rate_limit" integer null, "sandbox_create_rate_limit" integer null, "sandbox_lifecycle_rate_limit" integer null, "authenticated_rate_limit_ttl_seconds" integer null, "sandbox_create_rate_limit_ttl_seconds" integer null, "sandbox_lifecycle_rate_limit_ttl_seconds" integer null, "snapshot_deactivation_timeout_minutes" integer not null default 20160, "sandboxLimitedNetworkEgress" boolean not null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "organization_limits_organizationId_pk" primary key ("organizationId"));`);

    this.addSql(`create table "organization_funding" ("organizationId" uuid not null, "runwayWarning" varchar null, "runwayWarnedAt" timestamptz(3) null, "computeStoppedAt" timestamptz(3) null, "archiveDeletionNoticeAt" timestamptz(3) null, "archivesDeletedAt" timestamptz(3) null, "updatedAt" timestamptz(3) not null default now(), constraint "organization_funding_organizationId_pk" primary key ("organizationId"));`);

    this.addSql(`create table "machine" ("id" uuid not null default gen_random_uuid(), "organizationId" uuid not null, "identityPublicKey" text null, "identityKeyId" varchar null, "identityKeyRegisteredAt" timestamptz(3) null, "sshHostPublicKey" text null, "readinessReason" varchar(1024) null, "cpu" double precision not null default 0, "allocatableMemoryMiB" integer not null default 0, "vmMemoryOverheadMiB" integer not null default 0, "vcpuGranularity" integer not null default 1, "diskGiB" double precision not null default 0, "passthroughGpuCount" integer not null default 0, "sandboxClass" varchar not null default 'linux_vm', "currentCpuUsagePercentage" double precision not null default 0, "currentMemoryUsagePercentage" double precision not null default 0, "currentDiskUsagePercentage" double precision not null default 0, "currentAllocatedCpu" double precision not null default 0, "currentAllocatedMemoryMiB" integer not null default 0, "currentAllocatedDiskGiB" double precision not null default 0, "currentSupportCpu" double precision not null default 0, "currentSupportMemoryMiB" integer not null default 0, "currentSupportDiskGiB" double precision not null default 0, "currentSnapshotCount" integer not null default 0, "currentStartedSandboxes" integer not null default 0, "country" varchar(2) null, "continent" "continent_enum" null, "city" varchar null, "latitude" double precision null, "longitude" double precision null, "name" varchar not null, "state" "machine_state_enum" not null default 'initializing', "appVersion" varchar null default 'v0.0.0-dev', "apiVersion" varchar not null default '2', "lastChecked" timestamptz(3) null, "lastHealthyAt" timestamptz(3) null, "unschedulable" boolean not null default false, "draining" boolean not null default false, "withdrawnAt" timestamptz(3) null, "serviceHealth" jsonb null, "runtimeCapabilities" jsonb null, "updateStatus" jsonb null, "diagnostics" jsonb null, "paymentHolds" jsonb null, "localBenchmark" jsonb null, "maintenanceWindowStartMinute" integer null, "maintenanceWindowDurationMinutes" integer null, "offeredVcpus" integer null, "offeredMemoryGib" integer null, "offeredDiskGib" integer null, "maxUnclaimedFloat" numeric(40,0) null, "enrollmentKeyId" uuid null, "sessionGeneration" integer not null default 0, "tunnelPlanVersion" bigint not null default 0, "tunnelPlanGeneratedAt" timestamptz(3) not null default CURRENT_TIMESTAMP, "desiredStateRevision" bigint not null default 0, "desiredStateGeneratedAt" timestamptz(3) not null default CURRENT_TIMESTAMP, "sessionExpiresAt" timestamptz(3) null, "tier" varchar not null default 'private', "tierReasons" text[] not null default '{}', "tierChangedAt" timestamptz(3) not null default now(), "adminTierCap" varchar null, "adminTierCapReason" varchar null, "datacenterApprovedAt" timestamptz(3) null, "category" varchar null, "cpuModel" varchar null, "measuredVcpu" integer null, "measuredMemoryGib" integer null, "measuredDiskGib" integer null, "cpuSingleThreadScore" integer null, "cpuScorePerVcpu" integer null, "memoryBandwidthMibps" integer null, "memoryLatencyNs" integer null, "diskRandomReadIops" integer null, "diskSequentialMibps" integer null, "diskSequentialWriteMibps" integer null, "diskReadLatencyMicros" integer null, "diskFsyncLatencyMicros" integer null, "networkDownlinkMbps" integer null, "networkUplinkMbps" integer null, "networkMinRttMs" double precision null, "networkLoadedRttMs" double precision null, "networkJitterMs" double precision null, "gpuType" varchar null, "gpuCount" integer not null default 0, "gpuMemoryGib" integer not null default 0, "gpuTflops" integer not null default 0, "measuredAt" timestamptz(3) null, "latestBenchmarkId" uuid null, "inventoryDigest" varchar(64) null, "benchmarkedInventoryDigest" varchar(64) null, "fingerprintConflict" boolean not null default false, "listedSince" timestamptz(3) null, "restrictedAt" timestamptz(3) null, "restrictionReason" varchar null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "machine_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_machine_enrollment_key" on "machine" ("organizationId", "enrollmentKeyId") where "enrollmentKeyId" IS NOT NULL;`);
    this.addSql(`create index "IDX_machine_tier_category" on "machine" ("tier", "category");`);
    this.addSql(`create index "IDX_machine_ready_worker" on "machine" ("id") where "state" = 'ready';`);
    this.addSql(`create index "IDX_machine_unschedulable_worker" on "machine" ("id") where "unschedulable" = true;`);
    this.addSql(`create index "IDX_machine_draining_worker" on "machine" ("id") where "draining" = true and "state" <> 'decommissioned';`);
    this.addSql(`create index "IDX_machine_control_refresh" on "machine" ("tunnelPlanGeneratedAt", "id") where "sessionExpiresAt" is not null;`);
    this.addSql(`create index "IDX_machine_scheduling_session" on "machine" ("state", "unschedulable", "draining", "sessionExpiresAt");`);
    this.addSql(`create index "IDX_machine_organization_list" on "machine" ("organizationId", "createdAt", "id");`);
    this.addSql(`create index "IDX_machine_organization" on "machine" ("organizationId");`);
    this.addSql(`create index "IDX_machine_location" on "machine" ("continent", "country");`);
    this.addSql(`create index "IDX_machine_state_unschedulable" on "machine" ("state", "unschedulable");`);
    this.addSql(`create unique index "IDX_machine_identity_key" on "machine" ("identityKeyId") where "identityKeyId" IS NOT NULL;`);
    this.addSql(`alter table "machine" add constraint "UQ_machine_organization_name" unique ("organizationId", "name");`);

    this.addSql(`create table "machine_session" ("id" uuid not null default gen_random_uuid(), "machineId" uuid not null, "generation" integer not null, "tokenHash" varchar(64) not null, "expiresAt" timestamptz(3) not null, "revokedAt" timestamptz(3) null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "machine_session_id_pk" primary key ("id"));`);
    this.addSql(`create unique index "IDX_machine_session_token_hash" on "machine_session" ("tokenHash");`);
    this.addSql(`create index "IDX_machine_session_expiry" on "machine_session" ("expiresAt");`);
    this.addSql(`create unique index "IDX_machine_session_machine_generation" on "machine_session" ("machineId", "generation");`);

    this.addSql(`create table "machine_qualification_challenge" ("id" uuid not null default gen_random_uuid(), "machineId" uuid not null, "machineSessionId" uuid not null, "machineSessionGeneration" integer not null, "machineKeyId" varchar not null, "jobId" uuid null, "schemaVersion" integer not null, "policyVersion" integer not null, "qualificationClass" varchar not null, "requestedCheckIds" jsonb not null, "workLimits" jsonb not null, "canarySnapshot" text not null, "canaryCreditMicroUsd" numeric(40,0) not null default '0', "nonceDigest" varchar(64) not null, "requestDigest" varchar(64) not null, "inputFingerprint" varchar(71) not null, "releaseDigest" varchar(71) not null, "state" varchar(32) not null, "reasonCode" varchar null, "issuedAt" timestamptz(3) not null, "expiresAt" timestamptz(3) not null, "consumedAt" timestamptz(3) null, "completedAt" timestamptz(3) null, "createdAt" timestamptz(3) not null default now(), constraint "machine_qualification_challenge_id_pk" primary key ("id"));`);
    this.addSql(`create unique index "UQ_machine_qualification_challenge_job" on "machine_qualification_challenge" ("jobId") where "jobId" is not null;`);
    this.addSql(`create index "IDX_machine_qualification_challenge_machine_issued" on "machine_qualification_challenge" ("machineId", "issuedAt");`);
    this.addSql(`create index "IDX_machine_qualification_challenge_machine_state" on "machine_qualification_challenge" ("machineId", "state", "completedAt");`);

    this.addSql(`create table "machine_qualification_evidence" ("id" uuid not null default gen_random_uuid(), "challengeId" uuid not null, "canonicalPayload" jsonb not null, "payloadDigest" varchar(64) not null, "signature" varchar not null, "signingKeyId" varchar not null, "releaseDigest" varchar not null, "environmentFingerprint" varchar(71) not null, "checkResults" jsonb not null, "metrics" jsonb not null, "verdict" varchar(32) not null, "reasonCodes" jsonb not null, "evaluatorPolicyVersion" integer not null, "receivedAt" timestamptz(3) not null, "appraisedAt" timestamptz(3) not null, "createdAt" timestamptz(3) not null default now(), constraint "machine_qualification_evidence_id_pk" primary key ("id"));`);
    this.addSql(`create unique index "UQ_machine_qualification_evidence_digest" on "machine_qualification_evidence" ("payloadDigest");`);
    this.addSql(`create unique index "UQ_machine_qualification_evidence_challenge" on "machine_qualification_evidence" ("challengeId");`);

    this.addSql(`create table "machine_public_address" ("id" uuid not null default gen_random_uuid(), "machineId" uuid not null, "address" varchar not null, "firstSeenAt" timestamptz(3) not null, "lastSeenAt" timestamptz(3) not null, constraint "machine_public_address_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_machine_public_address_address" on "machine_public_address" ("address", "lastSeenAt");`);
    this.addSql(`create index "IDX_machine_public_address_machine" on "machine_public_address" ("machineId", "lastSeenAt");`);

    this.addSql(`create table "machine_observation" ("machineId" uuid not null, "sessionId" uuid not null, "generation" integer not null, "cpu" double precision not null, "allocatableMemoryMiB" integer not null, "diskGiB" double precision not null, "observedAt" timestamptz(3) not null, "uptimeOnlineSeconds" double precision not null default 0, "uptimeObservedSeconds" double precision not null default 0, "updatedAt" timestamptz(3) not null default now(), constraint "machine_observation_machineId_pk" primary key ("machineId"));`);

    this.addSql(`create table "machine_host_key" ("id" uuid not null default gen_random_uuid(), "machineId" uuid not null, "address" varchar(42) not null, "registeredAt" timestamptz(3) not null, "retiredAt" timestamptz(3) null, "createdAt" timestamptz(3) not null default now(), constraint "machine_host_key_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_machine_host_key_machine" on "machine_host_key" ("machineId");`);
    this.addSql(`create unique index "UQ_machine_host_key_current" on "machine_host_key" ("machineId") where "retiredAt" IS NULL;`);
    this.addSql(`alter table "machine_host_key" add constraint "UQ_machine_host_key_address" unique ("address");`);

    this.addSql(`create table "machine_health_gap" ("id" uuid not null default gen_random_uuid(), "machineId" uuid not null, "startAt" timestamptz(3) not null, "endAt" timestamptz(3) not null, constraint "machine_health_gap_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_machine_health_gap_machine" on "machine_health_gap" ("machineId", "endAt");`);

    this.addSql(`create table "machine_fingerprint_component" ("id" uuid not null default gen_random_uuid(), "machineId" uuid not null, "kind" varchar not null, "valueDigest" varchar(64) not null, "createdAt" timestamptz(3) not null default now(), constraint "machine_fingerprint_component_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_machine_fingerprint_component_value" on "machine_fingerprint_component" ("kind", "valueDigest");`);
    this.addSql(`alter table "machine_fingerprint_component" add constraint "UQ_machine_fingerprint_component" unique ("machineId", "kind", "valueDigest");`);

    this.addSql(`create table "machine_edge_binding" ("id" uuid not null default gen_random_uuid(), "machineId" uuid not null, "edgeId" uuid not null, "machineSessionGeneration" integer not null, "desiredState" varchar not null default 'active', "observedState" varchar not null default 'pending', "revision" integer not null default 1, "digest" char(64) not null, "targetRevision" integer not null default 1, "targetDigest" char(64) not null, "leaseExpiresAt" timestamptz(3) not null, "lastAcknowledgedAt" timestamptz(3) null, "activeConnectionId" uuid null, "replacementConnectionId" uuid null, "observedRttMilliseconds" double precision null, "observedLossRatio" double precision null, "observedCarrier" varchar null, "lastError" varchar(1000) null, "drainingAt" timestamptz(3) null, "releasedAt" timestamptz(3) null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "machine_edge_binding_id_pk" primary key ("id"));`);
    this.addSql(`create unique index "UQ_machine_edge_binding_backend_fence" on "machine_edge_binding" ("id", "machineId", "edgeId", "machineSessionGeneration", "revision", "digest");`);
    this.addSql(`create index "IDX_machine_edge_binding_machine_state" on "machine_edge_binding" ("machineId", "observedState");`);
    this.addSql(`create index "IDX_machine_edge_binding_edge_expiry" on "machine_edge_binding" ("edgeId", "leaseExpiresAt");`);
    this.addSql(`create unique index "UQ_machine_edge_binding_live" on "machine_edge_binding" ("machineId", "edgeId") where "observedState" in ('pending', 'active', 'replacing', 'draining');`);

    this.addSql(`create table "machine_connection_coverage" ("id" uuid not null default gen_random_uuid(), "machineId" uuid not null, "bucketStart" timestamptz(3) not null, "covered" tstzmultirange not null default '{}', "overflowWorkloadIds" text[] not null default '{}', constraint "machine_connection_coverage_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_machine_connection_coverage_bucket" on "machine_connection_coverage" ("bucketStart");`);
    this.addSql(`alter table "machine_connection_coverage" add constraint "UQ_machine_connection_coverage_bucket" unique ("machineId", "bucketStart");`);

    this.addSql(`create table "machine_benchmark" ("id" uuid not null default gen_random_uuid(), "machineId" uuid not null, "jobId" uuid null, "trigger" varchar not null, "state" varchar not null default 'pending', "suiteVersion" integer not null, "nonce" varchar(64) not null, "cpu" integer not null, "memoryGib" integer not null, "diskGib" integer not null, "gpu" integer not null, "issuedAt" timestamptz(3) not null, "challengeExpiresAt" timestamptz(3) not null, "completedAt" timestamptz(3) null, "measurements" jsonb null, "failureReasons" text[] not null default '{}', "evidenceDigest" varchar(64) null, "inventoryDigest" varchar(64) null, "release" varchar null, "attempt" integer not null default 1, "deferralReason" varchar null, "nextAttemptAt" timestamptz(3) null, "validUntil" timestamptz(3) null, constraint "machine_benchmark_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_machine_benchmark_machine" on "machine_benchmark" ("machineId", "issuedAt");`);
    this.addSql(`create unique index "UQ_machine_benchmark_pending" on "machine_benchmark" ("machineId") where "state" = 'pending';`);

    this.addSql(`create table "machine_assessment" ("machineId" uuid not null, "qualified" boolean not null default false, "reliabilityBasisPoints" integer not null default 0, "historicalSampleSize" integer not null default 0, "successfulSamples" integer not null default 0, "machineAttributableFailures" integer not null default 0, "unattributedFailureCount" integer not null default 0, "neutralEventCount" integer not null default 0, "successMass" double precision not null default 0, "failureMass" double precision not null default 0, "placementWindow" integer not null default 1, "attestationBasisPoints" integer not null default 10000, "reconciledWindowCount" integer not null default 0, "quarantinedLineCount" integer not null default 0, "uptimeBasisPoints" integer not null default 10000, "platformObservedEventCount" integer not null default 0, "healthBasisPoints" integer not null default 10000, "restrictionReason" varchar(64) null, "restrictedUntil" timestamptz(3) null, "probationEndsAt" timestamptz(3) null, "evidenceSince" timestamptz(3) null, "releasedAt" timestamptz(3) null, "relapseCount" integer not null default 0, "qualificationExpiresAt" timestamptz(3) null, "qualificationPolicyVersion" integer null, "observationWindowStartedAt" timestamptz(3) null, "observationWindowEndedAt" timestamptz(3) null, "trustStage" varchar not null default 'probationary', "policyVersion" integer not null default 1, "qualificationReasons" jsonb not null default '[]', "assessedAt" timestamptz(3) not null, "updatedAt" timestamptz(3) not null default now(), constraint "machine_assessment_machineId_pk" primary key ("machineId"));`);

    this.addSql(`create table "host_settlement" ("id" uuid not null default gen_random_uuid(), "chainId" integer not null, "contractAddress" varchar(42) not null, "machineId" uuid not null, "hostAddress" varchar(42) not null, "payoutAddress" varchar(42) not null, "relayFeeMicroUsd" numeric(40,0) not null, "nonce" numeric(40,0) not null, "deadline" timestamptz(3) not null, "signature" text not null, "items" jsonb not null, "status" varchar not null, "transactionHash" varchar(66) null, "error" text null, "settledAt" timestamptz(3) null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "host_settlement_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_host_settlement_machine" on "host_settlement" ("machineId", "createdAt");`);
    this.addSql(`create unique index "UQ_host_settlement_open" on "host_settlement" ("chainId", "contractAddress", "hostAddress") where "status" in ('queued', 'sent');`);

    this.addSql(`create table "host_profile" ("organizationId" uuid not null, "displayName" varchar(64) not null, "description" varchar(280) null, "hostTermsVersion" varchar null, "hostTermsAcceptedAt" timestamptz(3) null, "hostTermsAcceptedBy" uuid null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "host_profile_organizationId_pk" primary key ("organizationId"));`);

    this.addSql(`create table "escrow_event" ("id" uuid not null default gen_random_uuid(), "chainId" integer not null, "contractAddress" varchar(42) not null, "transactionHash" varchar(66) not null, "logIndex" integer not null, "blockNumber" bigint not null, "blockHash" varchar(66) not null, "blockTimestamp" timestamptz(3) not null, "kind" varchar not null, "args" jsonb not null, "customerAddress" varchar(42) null, "hostAddress" varchar(42) null, "channelId" varchar(66) null, "movements" jsonb not null, "customerOrganizationId" uuid null, "hostOrganizationId" uuid null, "processedAt" timestamptz(3) null, "createdAt" timestamptz(3) not null default now(), constraint "escrow_event_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_escrow_event_channel" on "escrow_event" ("chainId", "contractAddress", "channelId");`);
    this.addSql(`create index "IDX_escrow_event_host_address" on "escrow_event" ("hostAddress");`);
    this.addSql(`create index "IDX_escrow_event_customer_address" on "escrow_event" ("customerAddress");`);
    this.addSql(`create index "IDX_escrow_event_host_organization" on "escrow_event" ("hostOrganizationId", "blockNumber", "logIndex");`);
    this.addSql(`create index "IDX_escrow_event_customer_organization" on "escrow_event" ("customerOrganizationId", "blockNumber", "logIndex");`);
    this.addSql(`alter table "escrow_event" add constraint "UQ_escrow_event_log" unique ("chainId", "transactionHash", "logIndex");`);

    this.addSql(`create table "docker_registry" ("id" uuid not null default gen_random_uuid(), "name" varchar not null, "url" varchar not null, "username" varchar not null, "encryptedPassword" text null, "passwordVersion" integer not null default 0, "project" varchar not null default '', "organizationId" uuid null, "registryType" "docker_registry_registrytype_enum" not null default 'internal', "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "docker_registry_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_docker_registry_organization_list" on "docker_registry" ("organizationId", "registryType", "createdAt", "id");`);
    this.addSql(`create index "docker_registry_organizationId_registryType_index" on "docker_registry" ("organizationId", "registryType");`);

    this.addSql(`create table "delegated_signer" ("id" uuid not null default gen_random_uuid(), "chainId" integer not null, "contractAddress" varchar(42) not null, "organizationId" uuid not null, "customerAddress" varchar(42) not null, "signerAddress" varchar(42) not null, "encryptedPrivateKey" text not null, "retiredAt" timestamptz(3) null, "createdAt" timestamptz(3) not null default now(), constraint "delegated_signer_id_pk" primary key ("id"));`);
    this.addSql(`create unique index "UQ_delegated_signer_active_customer" on "delegated_signer" ("chainId", "contractAddress", "customerAddress") where "retiredAt" is null;`);
    this.addSql(`alter table "delegated_signer" add constraint "UQ_delegated_signer_signer" unique ("chainId", "contractAddress", "signerAddress");`);

    this.addSql(`create table "signature_audit" ("id" uuid not null default gen_random_uuid(), "delegatedSignerId" uuid not null, "kind" varchar not null, "digest" varchar(66) not null, "voucherId" uuid null, "evidence" jsonb not null, "signedAt" timestamptz(3) not null, "createdAt" timestamptz(3) not null default now(), constraint "signature_audit_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_signature_audit_signer" on "signature_audit" ("delegatedSignerId", "signedAt");`);

    this.addSql(`create table "billing_receipt" ("id" uuid not null default gen_random_uuid(), "organizationId" uuid not null, "month" char(7) not null, "sequence" integer not null, "issuedAt" timestamptz(3) not null, "billTo" jsonb not null, "content" jsonb not null, "createdAt" timestamptz(3) not null default now(), constraint "billing_receipt_id_pk" primary key ("id"));`);
    this.addSql(`alter table "billing_receipt" add constraint "UQ_billing_receipt_sequence" unique ("sequence");`);
    this.addSql(`alter table "billing_receipt" add constraint "UQ_billing_receipt_organization_month" unique ("organizationId", "month");`);

    this.addSql(`create table "billing_profile" ("organizationId" uuid not null, "legalName" varchar(200) not null, "addressLine1" varchar(200) not null, "addressLine2" varchar(200) null, "city" varchar(100) not null, "region" varchar(100) null, "postalCode" varchar(32) null, "country" char(2) not null, "taxId" varchar(64) null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "billing_profile_organizationId_pk" primary key ("organizationId"));`);

    this.addSql(`create table "billing_budget_version" ("organizationId" uuid not null, "resourceVersion" integer not null, "monthlyLimitMicroUsd" numeric(40,0) not null, "mode" varchar not null, "warningThresholdBasisPoints" integer not null, "updatedBy" varchar not null, "updatedAt" timestamptz(3) not null, constraint "billing_budget_version_organizationId_resourceVersion_pk" primary key ("organizationId", "resourceVersion"));`);
    this.addSql(`create index "IDX_billing_budget_version_history" on "billing_budget_version" ("organizationId", "updatedAt");`);

    this.addSql(`create table "billing_budget" ("organizationId" uuid not null, "resourceVersion" integer not null default 1, "monthlyLimitMicroUsd" numeric(40,0) not null, "mode" varchar not null default 'alert', "warningThresholdBasisPoints" integer not null default 8000, "updatedBy" varchar not null, "updatedAt" timestamptz(3) not null default now(), constraint "billing_budget_organizationId_pk" primary key ("organizationId"));`);

    this.addSql(`create table "auto_top_up" ("organizationId" uuid not null, "enabled" boolean not null, "amountMicroUsd" numeric(40,0) not null, "thresholdMicroUsd" numeric(40,0) not null, "timesPerDay" integer not null, "maxRelayFeeMicroUsd" numeric(40,0) not null, "lastAttemptAt" timestamptz(3) null, "lastTransactionHash" varchar(66) null, "lastFailedAt" timestamptz(3) null, "lastError" text null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "auto_top_up_organizationId_pk" primary key ("organizationId"));`);

    this.addSql(`create table "apikey" ("id" uuid not null default gen_random_uuid(), "configId" text not null default 'default', "name" text null, "start" text null, "referenceId" uuid not null, "prefix" text null, "key" text not null, "refillInterval" integer null, "refillAmount" integer null, "lastRefillAt" timestamptz(3) null, "enabled" boolean null default true, "rateLimitEnabled" boolean null default true, "rateLimitTimeWindow" integer null, "rateLimitMax" integer null, "requestCount" integer null default 0, "remaining" integer null, "lastRequest" timestamptz(3) null, "expiresAt" timestamptz(3) null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), "permissions" text null, "metadata" text null, constraint "apikey_id_pk" primary key ("id"));`);
    this.addSql(`create index "apikey_config_id_index" on "apikey" ("configId");`);
    this.addSql(`create index "apikey_reference_id_index" on "apikey" ("referenceId");`);
    this.addSql(`create index "apikey_key_index" on "apikey" ("key");`);

    this.addSql(`create table "sandbox" ("id" varchar not null default gen_random_uuid(), "organizationId" uuid not null, "name" varchar not null, "country" varchar(2) null, "continent" "continent_enum" null, "city" varchar null, "machineId" uuid null, "prevMachineId" uuid null, "placementKind" varchar not null default 'flexible', "apiKeyId" uuid null, "pinnedMachineId" uuid null, "placementCategory" varchar null, "placementLocations" text[] not null default '{}', "placementOwnMachinesOnly" boolean not null default false, "placementWholeMachine" boolean not null default false, "placementInterruptible" boolean not null default false, "originLatitude" double precision null, "originLongitude" double precision null, "placementMinimumTier" varchar null, "maxHourlyPriceMicroUsd" numeric(40,0) null, "voucherSigning" varchar not null default 'delegated', "startWaitUntil" timestamptz(3) null, "sandboxClass" varchar not null default 'linux_vm', "mode" "sandbox_mode_enum" not null, "capabilities" jsonb not null default '[]', "state" "sandbox_state_enum" not null default 'unknown', "desiredState" "sandbox_desiredstate_enum" not null default 'started', "snapshot" varchar null, "osUser" varchar not null, "errorReason" varchar null, "stopReason" varchar null, "fundsStoppedAt" timestamptz(3) null, "preemptedAt" timestamptz(3) null, "recoverable" boolean not null default false, "pausedForPayment" boolean not null default false, "env" jsonb not null default '{}', "networkBlockAll" boolean not null default false, "networkAllowList" varchar null, "domainAllowList" varchar null, "egressBandwidthBps" double precision null, "networkThrottleBandwidthBps" double precision null, "networkThrottleConnectionsPerSecond" integer null, "abuseEgressBlock" boolean not null default false, "abuseHold" boolean not null default false, "labels" jsonb null, "backupRegistryId" varchar null, "backupSnapshot" varchar null, "lastBackupAt" timestamptz(3) null, "backupSizeBytes" bigint null, "backupState" "sandbox_backupstate_enum" not null default 'none', "backupErrorReason" text null, "cpu" integer not null default 2, "gpu" integer not null default 0, "gpu_type" varchar null, "mem" integer not null default 4, "disk" integer not null default 10, "volumes" jsonb not null default '[]', "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), "autoStopInterval" integer not null default 15, "autoArchiveInterval" integer not null default 0, "autoDeleteInterval" integer not null default -1, "pending" boolean not null default false, "buildInfoSnapshotRef" varchar null, "daemonVersion" varchar null, "linkedSandboxId" varchar null, "specGeneration" integer not null default 0, "runtimeLifecycle" smallint null, "runtimeSpec" jsonb null, "runtimeSpecDigest" varchar(64) null, "runtimeDirectives" jsonb null, "runtimeRegistryId" varchar null, constraint "sandbox_id_pk" primary key ("id"));`);
    this.addSql(`create unique index "UQ_sandbox_active_linked_owner" on "sandbox" ("linkedSandboxId") where "linkedSandboxId" is not null and "desiredState" <> 'destroyed';`);
    this.addSql(`create index "sandbox_linked_sandbox_id_idx" on "sandbox" ("linkedSandboxId");`);
    this.addSql(`create index "IDX_sandbox_api_key" on "sandbox" ("apiKeyId") where "apiKeyId" is not null;`);
    this.addSql(`create index "idx_sandbox_volumes_gin" on "sandbox" using gin ("volumes" jsonb_path_ops) where "desiredState" <> 'destroyed';`);
    this.addSql(`create index "sandbox_labels_gin_full_idx" on "sandbox" using gin ("labels" jsonb_path_ops);`);
    this.addSql(`create index "sandbox_buildinfosnapshotref_idx" on "sandbox" ("buildInfoSnapshotRef") where "buildInfoSnapshotRef" is not null;`);
    this.addSql(`create index "idx_sandbox_recoverable" on "sandbox" ("id") where "recoverable" = true;`);
    this.addSql(`create index "IDX_sandbox_pending_machine_updated" on "sandbox" ("machineId", "updatedAt", "id") where "pending" = true;`);
    this.addSql(`create index "sandbox_pending_idx" on "sandbox" ("id") where "pending" = true;`);
    this.addSql(`create index "sandbox_active_only_idx" on "sandbox" ("id") where "state" <> all (array['destroyed'::sandbox_state_enum, 'archived'::sandbox_state_enum]);`);
    this.addSql(`create index "IDX_sandbox_backup_retry" on "sandbox" ("id") where "backupState" = 'error' and "desiredState" <> 'destroyed';`);
    this.addSql(`create index "IDX_sandbox_backup_in_progress" on "sandbox" ("id") where "backupState" = 'in_progress' and "desiredState" <> 'destroyed';`);
    this.addSql(`create index "IDX_sandbox_lifecycle_pending" on "sandbox" ("state", "desiredState", "id") where "pending" = false;`);
    this.addSql(`create index "sandbox_machine_state_desired_idx" on "sandbox" ("machineId", "state", "desiredState") where "pending" = false;`);
    this.addSql(`create index "sandbox_backupstate_idx" on "sandbox" ("backupState");`);
    this.addSql(`create index "sandbox_resources_idx" on "sandbox" ("cpu", "mem", "disk", "gpu");`);
    this.addSql(`create index "sandbox_location_idx" on "sandbox" ("continent", "country");`);
    this.addSql(`create index "IDX_sandbox_organization_state_created" on "sandbox" ("organizationId", "state", "createdAt", "id");`);
    this.addSql(`create index "IDX_sandbox_organization" on "sandbox" ("organizationId");`);
    this.addSql(`create index "sandbox_machine_state_idx" on "sandbox" ("machineId", "state");`);
    this.addSql(`create index "sandbox_machineid_idx" on "sandbox" ("machineId", "id");`);
    this.addSql(`create index "sandbox_snapshot_idx" on "sandbox" ("snapshot");`);
    this.addSql(`create index "sandbox_desiredstate_idx" on "sandbox" ("desiredState");`);
    this.addSql(`create index "sandbox_state_idx" on "sandbox" ("state");`);
    this.addSql(`create index "IDX_sandbox_preempted" on "sandbox" ("preemptedAt");`);
    this.addSql(`create unique index "UQ_sandbox_id_organization" on "sandbox" ("id", "organizationId");`);
    this.addSql(`alter table "sandbox" add constraint "UQ_sandbox_organization_name" unique ("organizationId", "name");`);

    this.addSql(`create table "ssh_access" ("id" uuid not null default gen_random_uuid(), "sandboxId" varchar not null, "token" text not null, "expiresAt" timestamp(3) not null, "createdAt" timestamp(3) not null default now(), "updatedAt" timestamp(3) not null default now(), constraint "ssh_access_id_pk" primary key ("id"));`);

    this.addSql(`create table "sandbox_secret_binding_set" ("sandboxId" varchar not null, "organizationId" uuid not null, "resourceVersion" integer not null default 1, "updatedAt" timestamptz(3) not null default now(), constraint "sandbox_secret_binding_set_sandboxId_pk" primary key ("sandboxId"));`);
    this.addSql(`create index "IDX_sandbox_secret_binding_set_organization" on "sandbox_secret_binding_set" ("organizationId");`);

    this.addSql(`create table "sandbox_secret_binding" ("id" uuid not null default gen_random_uuid(), "organizationId" uuid not null, "sandboxId" varchar not null, "environmentName" varchar(128) not null, "secretId" uuid not null, "secretVersion" integer not null, "secretVersionId" uuid not null, "createdByPrincipalType" varchar not null, "createdByPrincipalId" varchar not null, "createdAt" timestamptz(3) not null default now(), constraint "sandbox_secret_binding_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_sandbox_secret_binding_secret" on "sandbox_secret_binding" ("secretId", "secretVersion");`);
    this.addSql(`create unique index "UQ_sandbox_secret_binding_environment" on "sandbox_secret_binding" ("sandboxId", "environmentName");`);

    this.addSql(`create table "sandbox_placement" ("id" uuid not null default gen_random_uuid(), "sandboxId" varchar not null, "machineId" uuid not null, "assignmentGeneration" integer not null, "fencingToken" uuid not null, "placementKind" varchar not null, "locality" varchar null, "restoreFromBackup" varchar null, "placedAt" timestamptz(3) not null default now(), "releasedAt" timestamptz(3) null, "releaseReason" varchar null, constraint "sandbox_placement_id_pk" primary key ("id"));`);
    this.addSql(`create unique index "UQ_sandbox_placement_network_fence" on "sandbox_placement" ("id", "sandboxId", "machineId", "assignmentGeneration");`);
    this.addSql(`create index "IDX_sandbox_placement_machine" on "sandbox_placement" ("machineId", "placedAt", "id");`);
    this.addSql(`create index "IDX_sandbox_placement_machine_active" on "sandbox_placement" ("machineId") where "releasedAt" is null;`);
    this.addSql(`create unique index "IDX_sandbox_placement_active" on "sandbox_placement" ("sandboxId") where "releasedAt" is null;`);

    this.addSql(`create table "secret_delivery_event" ("id" uuid not null default gen_random_uuid(), "organizationId" uuid not null, "secretVersionId" uuid not null, "sandboxId" varchar not null, "placementId" uuid not null, "machineSessionId" uuid not null, "specGeneration" integer not null, "machineId" uuid not null, "assignmentGeneration" integer not null, "environmentName" varchar(128) not null, "outcome" varchar not null, "createdAt" timestamptz(3) not null default now(), constraint "secret_delivery_event_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_secret_delivery_event_organization_created" on "secret_delivery_event" ("organizationId", "createdAt");`);
    this.addSql(`create unique index "UQ_secret_delivery_attempt" on "secret_delivery_event" ("placementId", "specGeneration", "machineSessionId", "secretVersionId", "environmentName");`);

    this.addSql(`create table "early_session_failure" ("id" uuid not null default gen_random_uuid(), "placementId" uuid not null, "sandboxId" varchar not null, "assignmentGeneration" integer not null, "machineId" uuid not null, "customerOrganizationId" uuid not null, "sessionStartedAt" timestamptz(3) not null, "lastHealthyAt" timestamptz(3) not null, "detectedAt" timestamptz(3) not null default now(), constraint "early_session_failure_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_early_session_failure_machine" on "early_session_failure" ("machineId", "detectedAt");`);
    this.addSql(`alter table "early_session_failure" add constraint "UQ_early_session_failure_session" unique ("placementId", "assignmentGeneration", "sessionStartedAt");`);

    this.addSql(`create table "sandbox_observed_status" ("sandboxId" varchar not null, "machineId" uuid not null, "assignmentGeneration" integer not null, "observedSpecGeneration" integer not null, "state" smallint not null, "errorReason" text null, "recoverable" boolean not null default false, "daemonVersion" varchar null, "observedAt" timestamptz(3) not null, "receivedAt" timestamptz(3) not null, constraint "sandbox_observed_status_sandboxId_pk" primary key ("sandboxId"));`);

    this.addSql(`create table "sandbox_last_activity" ("sandboxId" varchar not null, "lastActivityAt" timestamptz(3) not null, constraint "sandbox_last_activity_sandboxId_pk" primary key ("sandboxId"));`);
    this.addSql(`create index "IDX_sandbox_last_activity_time" on "sandbox_last_activity" ("lastActivityAt", "sandboxId");`);

    this.addSql(`create table "sandbox_fork" ("id" uuid not null default gen_random_uuid(), "parentId" varchar not null, "childId" varchar not null, "createdAt" timestamptz(3) not null default now(), constraint "sandbox_fork_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_sandbox_fork_parent" on "sandbox_fork" ("parentId", "createdAt", "id");`);
    this.addSql(`alter table "sandbox_fork" add constraint "sandbox_fork_childId_unique" unique ("childId");`);

    this.addSql(`create table "machine_spot_check" ("id" uuid not null default gen_random_uuid(), "machineId" uuid not null, "sandboxId" varchar null, "state" varchar not null default 'scheduled', "nonce" varchar(64) not null, "scheduledAt" timestamptz(3) not null, "startedAt" timestamptz(3) null, "completedAt" timestamptz(3) null, "measurements" jsonb null, "canaryStartedAt" timestamptz(3) null, "canaryFinishedAt" timestamptz(3) null, "canaryUploadBytes" numeric(40,0) null, "canaryDownloadBytes" numeric(40,0) null, "canaryMeasuredEgressBytes" numeric(40,0) null, "canaryMeasuredIngressBytes" numeric(40,0) null, "failureReasons" text[] not null default '{}', constraint "machine_spot_check_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_machine_spot_check_machine" on "machine_spot_check" ("machineId", "completedAt");`);
    this.addSql(`create index "IDX_machine_spot_check_schedule" on "machine_spot_check" ("state", "scheduledAt");`);

    this.addSql(`create table "machine_reliability_event" ("id" uuid not null default gen_random_uuid(), "machineId" uuid not null, "placementId" uuid null, "sandboxId" varchar null, "jobId" uuid null, "jobAttempt" integer null, "specGeneration" integer null, "machineSessionId" uuid null, "assignmentGeneration" integer null, "workloadFingerprint" varchar(71) null, "eventKind" varchar(64) not null, "source" varchar(16) not null, "selfDealt" boolean not null default false, "customerOrganizationId" uuid null, "phase" varchar(32) not null, "outcome" varchar(16) not null, "severity" varchar(16) not null, "reasonCode" varchar(96) not null, "faultDomain" varchar(32) not null, "deduplicationKey" varchar(255) not null, "evidenceDigest" varchar(64) not null, "evidence" jsonb not null default '{}', "observedAt" timestamptz(3) not null, constraint "machine_reliability_event_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_machine_reliability_event_observed" on "machine_reliability_event" ("observedAt");`);
    this.addSql(`create index "IDX_machine_reliability_event_machine_workload" on "machine_reliability_event" ("machineId", "workloadFingerprint", "observedAt") include ("outcome");`);
    this.addSql(`create index "IDX_machine_reliability_event_placement_outcome" on "machine_reliability_event" ("placementId", "outcome", "observedAt");`);
    this.addSql(`create index "IDX_machine_reliability_event_machine_observed" on "machine_reliability_event" ("machineId", "observedAt", "id") include ("outcome", "source", "selfDealt", "workloadFingerprint", "customerOrganizationId", "placementId");`);
    this.addSql(`create unique index "UQ_machine_reliability_event_deduplication" on "machine_reliability_event" ("deduplicationKey");`);

    this.addSql(`create table "sandbox_exposure" ("id" uuid not null default gen_random_uuid(), "organizationId" uuid not null, "sandboxId" varchar not null, "name" varchar(64) not null, "kind" varchar not null, "protocol" varchar not null, "visibility" varchar null, "systemService" varchar null, "targetHost" varchar(253) not null default 'runtime', "targetReference" varchar(512) null, "targetPort" integer not null, "policy" jsonb not null, "desiredState" varchar not null default 'active', "observedState" varchar not null default 'pending', "generation" integer not null default 1, "routingKey" char(64) not null, "platformHostname" varchar(253) null, "originHostname" varchar(253) null, "lastError" varchar(1000) null, "deletionRequestedAt" timestamptz(3) null, "managedDnsDeletedAt" timestamptz(3) null, "systemRequestedUntil" timestamptz(3) null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "sandbox_exposure_id_pk" primary key ("id"));`);
    this.addSql(`create unique index "UQ_sandbox_exposure_system_service" on "sandbox_exposure" ("sandboxId", "systemService") where "systemService" is not null and "desiredState" <> 'deleted';`);
    this.addSql(`create index "IDX_sandbox_exposure_organization_state" on "sandbox_exposure" ("organizationId", "observedState");`);
    this.addSql(`create unique index "UQ_sandbox_exposure_origin_hostname" on "sandbox_exposure" ("originHostname") where "originHostname" is not null;`);
    this.addSql(`create unique index "UQ_sandbox_exposure_platform_hostname" on "sandbox_exposure" ("platformHostname") where "platformHostname" is not null;`);
    this.addSql(`create unique index "UQ_sandbox_exposure_backend_fence" on "sandbox_exposure" ("id", "sandboxId", "generation", "protocol", "targetPort");`);
    this.addSql(`create unique index "UQ_sandbox_exposure_name" on "sandbox_exposure" ("sandboxId", "name") where "desiredState" <> 'deleted';`);
    this.addSql(`alter table "sandbox_exposure" add constraint "UQ_sandbox_exposure_routing_key" unique ("routingKey");`);

    this.addSql(`create table "sandbox_exposure_reconciliation" ("exposureId" uuid not null, "requestedGeneration" integer not null, "attempt" integer not null default 0, "availableAt" timestamptz(3) not null default current_timestamp, "claimToken" uuid null, "claimExpiresAt" timestamptz(3) null, "lastError" varchar(1000) null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "sandbox_exposure_reconciliation_exposureId_pk" primary key ("exposureId"));`);
    this.addSql(`create index "IDX_exposure_reconciliation_available" on "sandbox_exposure_reconciliation" ("availableAt");`);

    this.addSql(`create table "sandbox_exposure_backend" ("id" uuid not null default gen_random_uuid(), "exposureId" uuid not null, "sandboxId" varchar not null, "machineId" uuid not null, "assignmentGeneration" integer not null, "placementId" uuid not null, "edgeId" uuid not null, "bindingId" uuid not null, "exposureGeneration" integer not null, "placementFencingTokenHash" char(64) not null, "machineSessionGeneration" integer not null, "bindingRevision" integer not null, "bindingDigest" char(64) not null, "targetRevision" integer not null default 1, "targetDigest" char(64) not null, "protocol" varchar not null, "targetPort" integer not null, "publicHost" varchar(253) not null, "publicPort" integer null, "state" varchar not null default 'pending', "routeTableVersion" bigint not null, "leaseExpiresAt" timestamptz(3) not null, "edgeAcknowledgedAt" timestamptz(3) null, "machineAcknowledgedAt" timestamptz(3) null, "dnsTargetHost" varchar(253) null, "dnsActivatedAt" timestamptz(3) null, "cutoverStartedAt" timestamptz(3) null, "cutoverVerifiedAt" timestamptz(3) null, "activatedAt" timestamptz(3) null, "drainingAt" timestamptz(3) null, "drainDeadline" timestamptz(3) null, "releasedAt" timestamptz(3) null, "failureReason" varchar(1000) null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "sandbox_exposure_backend_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_exposure_backend_edge_live_lease" on "sandbox_exposure_backend" ("edgeId", "leaseExpiresAt") where "state" in ('pending', 'active', 'draining');`);
    this.addSql(`create index "IDX_exposure_backend_lease" on "sandbox_exposure_backend" ("state", "leaseExpiresAt");`);
    this.addSql(`create index "IDX_exposure_backend_placement_state" on "sandbox_exposure_backend" ("placementId", "state");`);
    this.addSql(`create unique index "UQ_exposure_backend_live_listener" on "sandbox_exposure_backend" ("edgeId", "protocol", "publicPort") where "publicPort" is not null and "state" in ('pending', 'active', 'draining');`);
    this.addSql(`create unique index "UQ_exposure_backend_live_edge" on "sandbox_exposure_backend" ("exposureId", "edgeId") where "state" in ('pending', 'active', 'draining');`);

    this.addSql(`create table "sandbox_custom_domain" ("id" uuid not null default gen_random_uuid(), "organizationId" uuid not null, "sandboxId" varchar not null, "exposureId" uuid not null, "hostname" varchar(253) not null, "state" varchar not null default 'pending', "desiredGeneration" integer not null default 1, "observedGeneration" integer not null default 0, "providerId" varchar(128) null, "providerHostnameStatus" varchar(128) null, "certificateStatus" varchar(128) null, "originHostname" varchar(253) null, "verificationRecords" jsonb not null default '[]', "activatedAt" timestamptz(3) null, "verificationExpiresAt" timestamptz(3) null, "lastSynchronizedAt" timestamptz(3) null, "deletionRequestedAt" timestamptz(3) null, "lastError" varchar(1000) null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "sandbox_custom_domain_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_sandbox_custom_domain_organization_created" on "sandbox_custom_domain" ("organizationId", "createdAt");`);
    this.addSql(`create index "IDX_sandbox_custom_domain_exposure_state" on "sandbox_custom_domain" ("exposureId", "state");`);
    this.addSql(`alter table "sandbox_custom_domain" add constraint "UQ_sandbox_custom_domain_hostname" unique ("hostname");`);

    this.addSql(`create table "api_key_budget" ("apiKeyId" uuid not null, "organizationId" uuid not null, "computeSpendLimitMicroUsd" numeric(40,0) null, "maxConcurrentSandboxes" integer null, "updatedAt" timestamptz(3) not null default now(), constraint "api_key_budget_apiKeyId_pk" primary key ("apiKeyId"));`);
    this.addSql(`create index "IDX_api_key_budget_organization" on "api_key_budget" ("organizationId");`);

    this.addSql(`create table "member" ("id" uuid not null, "organizationId" uuid not null, "userId" uuid not null, "role" varchar not null default 'member', "createdAt" timestamptz(3) not null default now(), constraint "member_id_pk" primary key ("id"));`);
    this.addSql(`create index "member_userId_index" on "member" ("userId");`);
    this.addSql(`alter table "member" add constraint "member_organizationId_userId_unique" unique ("organizationId", "userId");`);

    this.addSql(`create table "machine_price_card" ("id" uuid not null default gen_random_uuid(), "machineId" uuid not null, "organizationId" uuid not null, "version" integer not null, "vcpuHourMicroUsd" numeric(40,0) not null, "memoryGibHourMicroUsd" numeric(40,0) not null, "gpuHourMicroUsd" numeric(40,0) not null, "diskGibMonthMicroUsd" numeric(40,0) not null, "vcpu" integer not null, "memoryGib" integer not null, "gpuCount" integer not null, "interruptibleBasisPoints" integer not null default 5000, "createdAt" timestamptz(3) not null default now(), "createdBy" uuid null, constraint "machine_price_card_id_pk" primary key ("id"));`);
    this.addSql(`alter table "machine_price_card" add constraint "UQ_machine_price_card_version" unique ("machineId", "version");`);

    this.addSql(`create table "placement_price" ("id" uuid not null default gen_random_uuid(), "sandboxId" varchar not null, "placementId" uuid not null, "customerOrganizationId" uuid not null, "hostOrganizationId" uuid not null, "machineId" uuid not null, "priceCardId" uuid null, "markupBasisPoints" integer not null, "placementKind" varchar not null, "maxHourlyPriceMicroUsd" numeric(40,0) null, "cpu" integer not null, "memoryGib" integer not null, "diskGib" integer not null, "gpu" integer not null, "wholeMachine" boolean not null default false, "interruptible" boolean not null default false, "startedAt" timestamptz(3) not null, "priceIncreaseAt" timestamptz(3) null, "priceIncreaseCardId" uuid null, "repriceAttempts" integer not null default 0, "repriceRetryAt" timestamptz(3) null, "endedAt" timestamptz(3) null, "endReason" varchar null, constraint "placement_price_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_placement_price_price_increase" on "placement_price" ("priceIncreaseAt") where "endedAt" is null and "priceIncreaseAt" is not null;`);
    this.addSql(`create index "IDX_placement_price_machine_open" on "placement_price" ("machineId") where "endedAt" is null;`);
    this.addSql(`create unique index "UQ_placement_price_open" on "placement_price" ("sandboxId") where "endedAt" is null;`);

    this.addSql(`create table "sandbox_usage_periods_archive" ("id" uuid not null default gen_random_uuid(), "sandboxId" varchar not null, "customerOrganizationId" uuid not null, "hostOrganizationId" uuid not null, "placementId" uuid not null, "machineId" uuid not null, "assignmentGeneration" integer not null, "placementPriceId" uuid not null, "mode" varchar not null, "startAt" timestamptz(3) not null, "endAt" timestamptz(3) not null, "cpu" double precision not null, "gpu" double precision not null, "gpu_type" varchar null, "mem" double precision not null, "disk" double precision not null, "minimumMillis" integer not null default 0, "runningSince" timestamptz(3) null, "sandboxClass" varchar not null default 'linux_vm', constraint "sandbox_usage_periods_archive_id_pk" primary key ("id"));`);

    this.addSql(`create table "sandbox_usage_periods" ("id" uuid not null default gen_random_uuid(), "sandboxId" varchar not null, "customerOrganizationId" uuid not null, "hostOrganizationId" uuid not null, "placementId" uuid not null, "machineId" uuid not null, "assignmentGeneration" integer not null, "placementPriceId" uuid not null, "mode" varchar not null, "startAt" timestamptz(3) not null, "endAt" timestamptz(3) null, "cpu" double precision not null, "gpu" double precision not null, "gpu_type" varchar null, "mem" double precision not null, "disk" double precision not null, "minimumMillis" integer not null default 0, "runningSince" timestamptz(3) null, "sandboxClass" varchar not null default 'linux_vm', constraint "sandbox_usage_periods_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_sandbox_usage_periods_host_open" on "sandbox_usage_periods" ("hostOrganizationId") where "endAt" is null;`);
    this.addSql(`create index "IDX_sandbox_usage_periods_customer_open" on "sandbox_usage_periods" ("customerOrganizationId") where "endAt" is null;`);
    this.addSql(`create unique index "sandbox_usage_periods_one_open_period_per_sandbox_idx" on "sandbox_usage_periods" ("sandboxId") where "endAt" is null;`);
    this.addSql(`create index "idx_sandbox_usage_periods_sandbox_end" on "sandbox_usage_periods" ("sandboxId", "endAt");`);

    this.addSql(`create table "sandbox_billable_usage" ("id" uuid not null default gen_random_uuid(), "usagePeriodId" uuid not null, "sandboxId" varchar not null, "customerOrganizationId" uuid not null, "hostOrganizationId" uuid not null, "placementId" uuid not null, "machineId" uuid not null, "assignmentGeneration" integer not null, "startAt" timestamptz(3) not null, "endAt" timestamptz(3) not null, "durationMillis" numeric(30,0) not null, "cpu" numeric(20,6) not null, "memoryGiB" numeric(20,6) not null, "diskGiB" numeric(20,6) not null, "gpu" numeric(20,6) not null, "placementPriceId" uuid not null, "runningMillis" numeric(40,6) not null, "vcpuMillis" numeric(40,6) not null, "memoryGibMillis" numeric(40,6) not null, "gpuMillis" numeric(40,6) not null, "runningDiskGibMillis" numeric(40,6) not null, "stoppedDiskGibMillis" numeric(40,6) not null, "hostChargeMicroUsd" numeric(40,0) not null, "markupChargeMicroUsd" numeric(40,0) not null, "totalChargeMicroUsd" numeric(40,0) not null, "policyVersion" integer not null default 2, "evidenceStatus" varchar not null default 'pending', "corroboratedAt" timestamptz(3) null, "observedComputeMillis" numeric(30,0) not null default '0', "observedStorageMillis" numeric(30,0) not null default '0', "receiptCount" integer not null default 0, "reconciliationReason" varchar null, "reconciledAt" timestamptz(3) null, "reconcileAttempts" integer not null default 0, "nextReconcileAt" timestamptz(3) not null, "createdAt" timestamptz(3) not null default now(), constraint "sandbox_billable_usage_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_sandbox_billable_usage_evidence" on "sandbox_billable_usage" ("evidenceStatus", "nextReconcileAt");`);
    this.addSql(`create index "IDX_sandbox_billable_usage_machine" on "sandbox_billable_usage" ("machineId", "endAt");`);
    this.addSql(`create index "IDX_sandbox_billable_usage_host" on "sandbox_billable_usage" ("hostOrganizationId", "endAt");`);
    this.addSql(`create index "IDX_sandbox_billable_usage_customer" on "sandbox_billable_usage" ("customerOrganizationId", "endAt");`);
    this.addSql(`create unique index "IDX_sandbox_billable_usage_period" on "sandbox_billable_usage" ("usagePeriodId");`);

    this.addSql(`create table "placement_billing_authorization" ("placementId" uuid not null, "sandboxId" varchar not null, "assignmentGeneration" integer not null, "customerOrganizationId" uuid not null, "hostOrganizationId" uuid not null, "placementPriceId" uuid not null, "estimatedHourlyMicroUsd" numeric(40,0) not null, "createdBy" varchar not null, "createdAt" timestamptz(3) not null, "releasedAt" timestamptz(3) null, constraint "placement_billing_authorization_placementId_pk" primary key ("placementId"));`);
    this.addSql(`create index "IDX_placement_billing_authorization_host" on "placement_billing_authorization" ("hostOrganizationId", "releasedAt");`);
    this.addSql(`create index "IDX_placement_billing_authorization_customer" on "placement_billing_authorization" ("customerOrganizationId", "releasedAt");`);

    this.addSql(`create table "payment_channel_charge" ("id" uuid not null default gen_random_uuid(), "paymentChannelId" uuid not null, "placementPriceId" uuid not null, "sandboxId" varchar not null, "chargedMicroUsd" numeric(40,0) not null, "endedAt" timestamptz(3) null, "settledAt" timestamptz(3) null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "payment_channel_charge_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_payment_channel_charge_sandbox" on "payment_channel_charge" ("sandboxId", "createdAt");`);
    this.addSql(`create index "IDX_payment_channel_charge_channel" on "payment_channel_charge" ("paymentChannelId", "settledAt");`);
    this.addSql(`alter table "payment_channel_charge" add constraint "UQ_payment_channel_charge_placement_price" unique ("placementPriceId");`);

    this.addSql(`create table "network_usage_period" ("id" uuid not null default gen_random_uuid(), "placementPriceId" uuid not null, "placementId" uuid not null, "sandboxId" varchar not null, "machineId" uuid not null, "customerOrganizationId" uuid not null, "hostOrganizationId" uuid not null, "assignmentGeneration" integer not null, "periodStart" timestamptz(3) not null, "supplement" integer not null default 0, "periodEnd" timestamptz(3) not null, "edgeEgressBytes" numeric(40,0) not null, "edgeIngressBytes" numeric(40,0) not null, "internetEgressBytes" numeric(40,0) not null, "internetIngressBytes" numeric(40,0) not null, "hostEgressBytes" numeric(40,0) not null, "hostIngressBytes" numeric(40,0) not null, "clampedInternetEgressBytes" numeric(40,0) not null, "receiptCount" integer not null, "edgeSampleCount" integer not null, "createdAt" timestamptz(3) not null default now(), constraint "network_usage_period_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_network_usage_period_placement" on "network_usage_period" ("placementId", "periodStart");`);
    this.addSql(`create index "IDX_network_usage_period_host" on "network_usage_period" ("hostOrganizationId", "periodStart");`);
    this.addSql(`create index "IDX_network_usage_period_customer" on "network_usage_period" ("customerOrganizationId", "periodStart");`);
    this.addSql(`alter table "network_usage_period" add constraint "UQ_network_usage_period_price_start_supplement" unique ("placementPriceId", "periodStart", "supplement");`);

    this.addSql(`create table "machine_usage_receipt" ("id" uuid not null default gen_random_uuid(), "machineId" uuid not null, "sessionId" uuid not null, "placementId" uuid not null, "sandboxId" varchar not null, "assignmentGeneration" integer not null, "fencingToken" uuid not null, "generationId" uuid not null, "sequence" numeric(30,0) not null, "previousDigest" varchar(64) not null, "predecessorId" uuid null, "sampledAt" timestamptz(3) not null, "intervalStartAt" timestamptz(3) not null, "intervalStartState" varchar not null, "state" varchar not null, "runningMillis" numeric(30,0) not null, "internetEgressBytes" numeric(40,0) not null, "internetIngressBytes" numeric(40,0) not null, "hostEgressBytes" numeric(40,0) not null, "hostIngressBytes" numeric(40,0) not null, "tapEgressBytes" numeric(40,0) not null, "tapIngressBytes" numeric(40,0) not null, "acceptedInternetEgressDeltaBytes" numeric(40,0) not null, "acceptedInternetIngressDeltaBytes" numeric(40,0) not null, "clampedInternetEgressBytes" numeric(40,0) not null, "clampedInternetIngressBytes" numeric(40,0) not null, "hostEgressDeltaBytes" numeric(40,0) not null, "hostIngressDeltaBytes" numeric(40,0) not null, "cpu" integer not null, "memoryGiB" integer not null, "diskGiB" integer not null, "gpu" integer not null, "acceptedComputeDeltaMillis" numeric(30,0) not null, "acceptedStorageDeltaMillis" numeric(30,0) not null, "payloadDigest" varchar(64) not null, "signature" varchar(128) not null, "signerPublicKey" text not null, "envelope" jsonb not null, "networkPeriodId" uuid null, "receivedAt" timestamptz(3) not null default now(), constraint "machine_usage_receipt_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_machine_usage_receipt_predecessor" on "machine_usage_receipt" ("predecessorId", "placementId");`);
    this.addSql(`create index "IDX_machine_usage_receipt_network_period" on "machine_usage_receipt" ("networkPeriodId");`);
    this.addSql(`create index "IDX_machine_usage_receipt_unrated_network" on "machine_usage_receipt" ("receivedAt") where "networkPeriodId" is null;`);
    this.addSql(`create index "IDX_machine_usage_receipt_placement_time" on "machine_usage_receipt" ("placementId", "sampledAt");`);
    this.addSql(`create unique index "IDX_machine_usage_receipt_chain" on "machine_usage_receipt" ("placementId", "generationId", "previousDigest");`);
    this.addSql(`create unique index "IDX_machine_usage_receipt_sequence" on "machine_usage_receipt" ("machineId", "placementId", "generationId", "sequence");`);
    this.addSql(`create unique index "IDX_machine_usage_receipt_digest" on "machine_usage_receipt" ("payloadDigest");`);

    this.addSql(`create table "exposure_network_usage" ("id" uuid not null default gen_random_uuid(), "edgeCheckpointId" uuid not null, "backendId" uuid not null, "exposureId" uuid not null, "organizationId" uuid not null, "sandboxId" varchar not null, "placementId" uuid not null, "machineId" uuid not null, "edgeId" uuid not null, "assignmentGeneration" integer not null, "protocol" varchar not null, "intervalStartedAt" timestamptz(3) not null, "intervalEndedAt" timestamptz(3) not null, "edgeBytesIn" numeric(40,0) not null, "edgeBytesOut" numeric(40,0) not null, "edgePacketsIn" numeric(40,0) not null, "edgePacketsOut" numeric(40,0) not null, "billable" boolean not null, "periodId" uuid null, "createdAt" timestamptz(3) not null default now(), constraint "exposure_network_usage_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_exposure_network_usage_period" on "exposure_network_usage" ("periodId");`);
    this.addSql(`create index "IDX_exposure_network_usage_placement" on "exposure_network_usage" ("placementId", "createdAt");`);
    this.addSql(`create index "IDX_exposure_network_usage_unrated" on "exposure_network_usage" ("createdAt") where "periodId" is null;`);
    this.addSql(`alter table "exposure_network_usage" add constraint "UQ_exposure_network_usage_edge_sample" unique ("edgeCheckpointId", "backendId");`);

    this.addSql(`create table "billing_line_item" ("id" uuid not null default gen_random_uuid(), "schemaVersion" integer not null, "sourceType" varchar not null, "sourceId" uuid not null, "sourceVersion" integer not null, "customerOrganizationId" uuid not null, "beneficiaryKind" varchar not null, "beneficiaryReference" varchar not null, "hostOrganizationId" uuid null, "sandboxId" varchar not null, "placementId" uuid not null, "machineId" uuid not null, "assignmentGeneration" integer not null, "resourceSku" varchar not null, "periodStart" timestamptz(3) not null, "periodEnd" timestamptz(3) not null, "serviceThrough" timestamptz(3) not null, "consumedQuantities" jsonb not null, "placementPriceId" uuid null, "quantities" jsonb null, "grossMicroUsd" numeric(40,0) not null, "hostMicroUsd" numeric(40,0) not null, "markupMicroUsd" numeric(40,0) not null, "evidenceStatus" varchar not null, "contentDigest" varchar(64) not null, "reconciliationReason" text null, "reconciledAt" timestamptz(3) null, "earningsReleasedAt" timestamptz(3) null, "createdAt" timestamptz(3) not null default now(), constraint "billing_line_item_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_billing_line_earnings_unreleased" on "billing_line_item" ("hostOrganizationId") where "earningsReleasedAt" is null and "hostMicroUsd" > 0;`);
    this.addSql(`create index "IDX_billing_line_host_state" on "billing_line_item" ("hostOrganizationId", "evidenceStatus");`);
    this.addSql(`create index "IDX_billing_line_machine_attestation" on "billing_line_item" ("machineId", "reconciledAt") where "evidenceStatus" = 'corroborated' and "sourceType" = 'sandbox_usage_period';`);
    this.addSql(`create index "IDX_billing_line_machine_pending" on "billing_line_item" ("machineId") where "evidenceStatus" = 'pending';`);
    this.addSql(`create index "IDX_billing_line_eligibility" on "billing_line_item" ("evidenceStatus", "serviceThrough");`);
    this.addSql(`create index "IDX_billing_line_placement" on "billing_line_item" ("placementId", "evidenceStatus");`);
    this.addSql(`create index "IDX_billing_line_beneficiary" on "billing_line_item" ("beneficiaryKind", "beneficiaryReference", "serviceThrough");`);
    this.addSql(`create index "IDX_billing_line_customer" on "billing_line_item" ("customerOrganizationId", "serviceThrough");`);
    this.addSql(`create unique index "IDX_billing_line_source" on "billing_line_item" ("sourceType", "sourceId", "sourceVersion");`);

    this.addSql(`create table "billing_line_quarantine" ("lineItemId" uuid not null, "machineId" uuid not null, "failureCode" varchar(64) not null, "faultDomain" varchar(16) not null, "evidenceRoot" varchar(64) null, "auditPolicyVersion" integer not null, "quarantinedAt" timestamptz(3) not null, constraint "billing_line_quarantine_lineItemId_pk" primary key ("lineItemId"));`);
    this.addSql(`create index "IDX_billing_line_quarantine_machine" on "billing_line_quarantine" ("machineId", "quarantinedAt");`);

    this.addSql(`create table "billing_line_adjustment" ("id" uuid not null default gen_random_uuid(), "lineItemId" uuid not null, "kind" varchar not null, "amountMicroUsd" numeric(40,0) not null, "reasonCode" varchar not null, "explanation" text not null, "actorId" varchar not null, "evidenceDigest" varchar(64) not null, "policyVersion" integer not null, "createdAt" timestamptz(3) not null default now(), constraint "billing_line_adjustment_id_pk" primary key ("id"));`);
    this.addSql(`create unique index "IDX_billing_line_adjustment_evidence" on "billing_line_adjustment" ("evidenceDigest");`);
    this.addSql(`create index "IDX_billing_line_adjustment_line" on "billing_line_adjustment" ("lineItemId", "createdAt");`);

    this.addSql(`create table "billing_evidence_bundle" ("id" uuid not null default gen_random_uuid(), "lineItemId" uuid not null, "schemaVersion" integer not null, "kind" varchar(16) not null, "root" char(64) not null, "payload" jsonb not null, "createdAt" timestamptz(3) not null default now(), constraint "billing_evidence_bundle_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_billing_evidence_bundle_created" on "billing_evidence_bundle" ("createdAt");`);
    this.addSql(`create unique index "UQ_billing_evidence_bundle_root" on "billing_evidence_bundle" (root);`);
    this.addSql(`create unique index "UQ_billing_evidence_bundle_line" on "billing_evidence_bundle" ("lineItemId");`);

    this.addSql(`create table "machine_listing" ("machineId" uuid not null, "state" varchar not null default 'draft', "visibility" varchar not null default 'private', "currentPriceCardId" uuid null, "gpuOnly" boolean not null default false, "interruptibleEnabled" boolean not null default true, "monthlyTrafficCapGb" integer null, "trafficCapReachedAt" timestamptz(3) null, "trafficMonth" varchar null, "trafficBytes" bigint null, "version" integer not null default 1, "updatedAt" timestamptz(3) not null default now(), constraint "machine_listing_machineId_pk" primary key ("machineId"));`);

    this.addSql(`create table "invitation" ("id" uuid not null, "organizationId" uuid not null, "email" varchar not null, "role" varchar null, "status" varchar not null default 'pending', "expiresAt" timestamptz(3) not null, "inviterId" uuid not null, "createdAt" timestamptz(3) not null default now(), constraint "invitation_id_pk" primary key ("id"));`);
    this.addSql(`create index "invitation_organizationId_index" on "invitation" ("organizationId");`);
    this.addSql(`create index "invitation_email_index" on "invitation" ("email");`);

    this.addSql(`create table "account" ("id" uuid not null default gen_random_uuid(), "accountId" varchar not null, "providerId" varchar not null, "accessToken" text null, "refreshToken" text null, "idToken" text null, "accessTokenExpiresAt" timestamptz(3) null, "refreshTokenExpiresAt" timestamptz(3) null, "scope" text null, "password" text null, "userId" uuid not null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "account_id_pk" primary key ("id"));`);
    this.addSql(`create index "account_user_id_index" on "account" ("userId");`);

    this.addSql(`create table "abuse_case" ("id" uuid not null default gen_random_uuid(), "sandboxId" varchar not null, "organizationId" uuid not null, "machineId" uuid null, "status" varchar not null default 'observed', "findings" jsonb not null, "firstSeenAt" timestamptz(3) not null, "lastSeenAt" timestamptz(3) not null, "throttledAt" timestamptz(3) null, "notifiedAt" timestamptz(3) null, "suspendedAt" timestamptz(3) null, "resolvedAt" timestamptz(3) null, "manual" boolean not null default false, "previewDisabledAt" timestamptz(3) null, "egressBlockedAt" timestamptz(3) null, "pausedAt" timestamptz(3) null, "terminatedAt" timestamptz(3) null, "organizationSuspendedAt" timestamptz(3) null, "referredAt" timestamptz(3) null, "resolvedBy" uuid null, constraint "abuse_case_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_abuse_case_organization_status" on "abuse_case" ("organizationId", "status");`);
    this.addSql(`create index "IDX_abuse_case_last_seen" on "abuse_case" ("lastSeenAt", "id");`);
    this.addSql(`create index "IDX_abuse_case_status_last_seen" on "abuse_case" ("status", "lastSeenAt", "id");`);
    this.addSql(`create unique index "UQ_abuse_case_open_sandbox" on "abuse_case" ("sandboxId") where "status" <> 'resolved';`);

    this.addSql(`create table "abuse_report" ("id" uuid not null default gen_random_uuid(), "reporterType" varchar not null, "category" varchar not null, "status" varchar not null default 'received', "url" text null, "hostname" varchar null, "description" text not null, "reporterName" varchar null, "reporterEmail" varchar null, "reporterUserId" uuid null, "reporterOrganizationId" uuid null, "dmca" jsonb null, "ispComplaint" jsonb null, "ispOutcome" varchar null, "restricted" boolean not null default false, "abuseCaseId" uuid null, "sandboxId" varchar null, "organizationId" uuid null, "machineId" uuid null, "dueAt" timestamptz(3) not null, "acknowledgedAt" timestamptz(3) null, "decidedAt" timestamptz(3) null, "decidedBy" uuid null, "decisionNote" text null, "appealText" text null, "appealedAt" timestamptz(3) null, "counterNotice" jsonb null, "counterNoticeReceivedAt" timestamptz(3) null, "counterNoticeForwardedAt" timestamptz(3) null, "restoreAfter" timestamptz(3) null, "restoreBy" timestamptz(3) null, "courtActionFiledAt" timestamptz(3) null, "restoredAt" timestamptz(3) null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "abuse_report_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_abuse_report_restore_after" on "abuse_report" ("restoreAfter");`);
    this.addSql(`create index "IDX_abuse_report_case" on "abuse_report" ("abuseCaseId");`);
    this.addSql(`create index "IDX_abuse_report_status_due" on "abuse_report" ("status", "dueAt");`);

    this.addSql(`create table "abuse_evidence" ("id" uuid not null default gen_random_uuid(), "abuseCaseId" uuid not null, "kind" varchar not null, "restricted" boolean not null, "payload" jsonb not null, "retainUntil" timestamptz(3) not null, "createdAt" timestamptz(3) not null default now(), constraint "abuse_evidence_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_abuse_evidence_retain" on "abuse_evidence" ("retainUntil");`);
    this.addSql(`create index "IDX_abuse_evidence_case" on "abuse_evidence" ("abuseCaseId");`);

    this.addSql(`create table "abuse_case_action" ("id" uuid not null default gen_random_uuid(), "abuseCaseId" uuid not null, "action" varchar not null, "actorId" uuid null, "note" text null, "createdAt" timestamptz(3) not null default now(), constraint "abuse_case_action_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_abuse_case_action_case" on "abuse_case_action" ("abuseCaseId", "createdAt");`);

    this.addSql(`create table "user_wallet" ("id" uuid not null default gen_random_uuid(), "userId" uuid null, "passkeyId" uuid null, "chainId" integer not null, "publicKeyX" varchar(66) not null, "publicKeyY" varchar(66) not null, "verifiers" text not null, "signerAddress" varchar(42) not null, "safeAddress" varchar(42) not null, "deployedAt" timestamptz(3) null, "recoveryStatus" varchar not null, "recoveryOwnerAddress" varchar(42) null, "recoveryOwnerKind" varchar null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "user_wallet_id_pk" primary key ("id"));`);
    this.addSql(`alter table "user_wallet" add constraint "UQ_user_wallet_safe" unique ("chainId", "safeAddress");`);
    this.addSql(`alter table "user_wallet" add constraint "UQ_user_wallet_user" unique ("userId");`);

    this.addSql(`create table "verification_review" ("id" uuid not null default gen_random_uuid(), "machineId" uuid not null, "kind" varchar not null, "referenceId" uuid not null, "state" varchar not null default 'open', "openedAt" timestamptz(3) not null default now(), "resolvedAt" timestamptz(3) null, "resolvedBy" uuid null, "resolutionReason" varchar null, "forfeitedMicroUsd" numeric(40,0) null, constraint "verification_review_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_verification_review_opened" on "verification_review" ("openedAt", "id");`);
    this.addSql(`create index "IDX_verification_review_queue" on "verification_review" ("state", "openedAt");`);

    this.addSql(`create table "volume" ("id" uuid not null default gen_random_uuid(), "organizationId" uuid null, "name" varchar not null, "sizeGiB" integer not null default 10, "filesystem" varchar not null default 'ext4', "generation" integer not null default 1, "targetSizeGiB" integer null, "attachmentGeneration" integer not null default 0, "activeAttachmentId" uuid null, "activeMachineId" uuid null, "homeMachineId" uuid null, "fencingToken" uuid null, "backupArtifactId" uuid null, "backupGeneration" integer null, "backupState" "volume_backup_state_enum" not null default 'none', "lastBackupAt" timestamptz(3) null, "state" "volume_state_enum" not null default 'ready', "errorReason" varchar null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), "lastUsedAt" timestamp(3) null, constraint "volume_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_volume_organization_list" on "volume" ("organizationId", "lastUsedAt" desc nulls last, "createdAt" desc, id desc);`);
    this.addSql(`create index "IDX_volume_pending_delete" on "volume" ("createdAt", "id") where "state" = 'pending_delete';`);
    this.addSql(`create unique index "UQ_volume_organization_name" on "volume" ("organizationId", "name") where "state" <> 'deleted';`);

    this.addSql(`create table "volume_backup" ("artifactId" uuid not null, "volumeId" uuid not null, "organizationId" uuid not null, "sandboxId" uuid not null, "machineId" uuid not null, "backupGeneration" integer not null, "attachmentGeneration" integer not null, "fencingToken" uuid not null, "baseArtifactId" uuid null, "chainDepth" integer not null, "dataKeyCiphertext" text not null, "dataKeyEnvelopeVersion" integer not null default 1, "state" "volume_backup_state_enum" not null, "packSizeBytes" bigint null, "manifestSizeBytes" bigint null, "changedBytes" bigint null, "referencedArtifactIds" uuid[] not null, "expectedVolumeSizeBytes" bigint not null, "errorReason" text null, "completedAt" timestamptz(3) null, "prunedAt" timestamptz(3) null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "volume_backup_artifactId_pk" primary key ("artifactId"));`);
    this.addSql(`create index "IDX_volume_backup_sandbox_state" on "volume_backup" ("sandboxId", "state");`);
    this.addSql(`alter table "volume_backup" add constraint "UQ_volume_backup_generation" unique ("volumeId", "backupGeneration");`);

    this.addSql(`create table "wallet_transaction" ("id" uuid not null default gen_random_uuid(), "userWalletId" uuid not null, "signerAddress" varchar(42) not null, "signerPublicKeyX" varchar(66) not null, "signerPublicKeyY" varchar(66) not null, "signerVerifiers" text not null, "safeNonce" numeric(40,0) not null, "to" varchar(42) not null, "data" text not null, "operation" integer not null, "safeTxHash" varchar(66) not null, "feeMicroUsd" numeric(40,0) not null, "feePaidMicroUsd" numeric(40,0) null, "signatures" text not null, "recoveryOwnerKind" varchar null, "recoveryOwnerAddress" varchar(42) null, "status" varchar not null, "transactionHash" varchar(66) null, "error" text null, "settledAt" timestamptz(3) null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "wallet_transaction_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_wallet_transaction_open" on "wallet_transaction" ("createdAt") where "status" in ('queued', 'sent');`);
    this.addSql(`create index "IDX_wallet_transaction_wallet_created" on "wallet_transaction" ("userWalletId", "createdAt");`);
    this.addSql(`alter table "wallet_transaction" add constraint "UQ_wallet_transaction_safe_tx_hash" unique ("userWalletId", "safeTxHash");`);

    this.addSql(`create table "settlement_transaction" ("id" uuid not null default gen_random_uuid(), "chainId" integer not null, "contractAddress" varchar(42) not null, "kind" varchar not null, "transactionHash" varchar(66) not null, "nonce" integer not null, "signedTransaction" text not null, "initialMaxFeePerGas" numeric(40,0) not null, "replacedTransactionHashes" jsonb not null default '[]', "signedAt" timestamptz(3) not null, "status" varchar not null, "walletTransactionId" uuid null, "hostSettlementId" uuid null, "hostAddress" varchar(42) null, "error" text null, "sentAt" timestamptz(3) not null, "settledAt" timestamptz(3) null, "createdAt" timestamptz(3) not null default now(), constraint "settlement_transaction_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_settlement_transaction_kind" on "settlement_transaction" ("kind", "sentAt");`);
    this.addSql(`create index "IDX_settlement_transaction_pending" on "settlement_transaction" ("sentAt") where "status" = 'pending';`);
    this.addSql(`alter table "settlement_transaction" add constraint "UQ_settlement_transaction_hash" unique ("chainId", "transactionHash");`);

    this.addSql(`create table "claim_attempt" ("id" uuid not null default gen_random_uuid(), "transactionId" uuid not null, "paymentChannelId" uuid not null, "voucherId" uuid not null, "itemIndex" integer not null, "maxAmountMicroUsd" numeric(40,0) not null, "paidMicroUsd" numeric(40,0) null, "failure" varchar null, "createdAt" timestamptz(3) not null default now(), constraint "claim_attempt_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_claim_attempt_transaction" on "claim_attempt" ("transactionId");`);
    this.addSql(`create index "IDX_claim_attempt_channel" on "claim_attempt" ("paymentChannelId", "createdAt");`);

    this.addSql(`create table "webhook_endpoint" ("id" uuid not null default gen_random_uuid(), "organizationId" uuid not null, "url" varchar(2048) not null, "description" varchar(512) null, "eventTypes" text[] not null, "enabled" boolean not null default true, "disabledReason" varchar null, "disabledAt" timestamptz(3) null, "disabledNoticeSentAt" timestamptz(3) null, "failingSince" timestamptz(3) null, "lastSucceededAt" timestamptz(3) null, "secretVersion" integer not null, "encryptedSecret" text not null, "previousEncryptedSecret" text null, "previousSecretExpiresAt" timestamptz(3) null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "webhook_endpoint_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_webhook_endpoint_disabled_notice_pending" on "webhook_endpoint" ("disabledAt") where "disabledReason" = 'failing' and "disabledNoticeSentAt" is null;`);
    this.addSql(`create unique index "UQ_webhook_endpoint_id_organization" on "webhook_endpoint" ("id", "organizationId");`);
    this.addSql(`create index "IDX_webhook_endpoint_organization_created" on "webhook_endpoint" ("organizationId", "createdAt");`);

    this.addSql(`create table "webhook_message" ("id" uuid not null default gen_random_uuid(), "organizationId" uuid not null, "eventType" varchar not null, "payload" jsonb not null, "deduplicationKey" varchar not null, "createdAt" timestamptz(3) not null default now(), constraint "webhook_message_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_webhook_message_created" on "webhook_message" ("createdAt");`);
    this.addSql(`create unique index "UQ_webhook_message_id_organization" on "webhook_message" ("id", "organizationId");`);
    this.addSql(`alter table "webhook_message" add constraint "UQ_webhook_message_deduplication_key" unique ("organizationId", "deduplicationKey");`);

    this.addSql(`create table "webhook_delivery" ("id" uuid not null default gen_random_uuid(), "organizationId" uuid not null, "endpointId" uuid not null, "messageId" uuid not null, "status" varchar not null default 'pending', "attempts" integer not null default 0, "nextTrigger" varchar not null default 'scheduled', "nextAttemptAt" timestamptz(3) null, "lockId" uuid null, "lockedUntil" timestamptz(3) null, "lastAttemptAt" timestamptz(3) null, "lastResponseStatus" integer null, "createdAt" timestamptz(3) not null default now(), "updatedAt" timestamptz(3) not null default now(), constraint "webhook_delivery_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_webhook_delivery_endpoint_created" on "webhook_delivery" ("endpointId", "organizationId", "createdAt");`);
    this.addSql(`create index "IDX_webhook_delivery_message" on "webhook_delivery" ("messageId", "organizationId");`);
    this.addSql(`create index "IDX_webhook_delivery_dispatch" on "webhook_delivery" ("nextAttemptAt") where "status" = 'pending';`);
    this.addSql(`alter table "webhook_delivery" add constraint "UQ_webhook_delivery_endpoint_message" unique ("endpointId", "organizationId", "messageId");`);

    this.addSql(`create table "webhook_delivery_attempt" ("id" uuid not null default gen_random_uuid(), "organizationId" uuid not null, "deliveryId" uuid not null, "trigger" varchar not null, "succeeded" boolean not null, "responseStatus" integer null, "responseBody" text null, "error" text null, "durationMilliseconds" integer not null, "createdAt" timestamptz(3) not null default now(), constraint "webhook_delivery_attempt_id_pk" primary key ("id"));`);
    this.addSql(`create index "IDX_webhook_delivery_attempt_delivery_created" on "webhook_delivery_attempt" ("deliveryId", "createdAt");`);

    this.addSql(`alter table "abuse_hostname" add constraint "CHK_abuse_hostname_kind" check ("kind" in ('preview', 'origin', 'custom_domain', 'port'));`);

    this.addSql(`alter table "api_idempotency_record" add constraint "CHK_api_idempotency_state" check (state in ('completed', 'failed_terminal'));`);
    this.addSql(`alter table "api_idempotency_record" add constraint "CHK_api_idempotency_principal_type" check ("principalType" in ('human'));`);
    this.addSql(`alter table "api_idempotency_record" add constraint "CHK_api_idempotency_terminal_problem" check (state <> 'failed_terminal' or ("terminalProblem" is not null and "completedAt" is not null));`);
    this.addSql(`alter table "api_idempotency_record" add constraint "CHK_api_idempotency_completed_response" check (state <> 'completed' or ("responseStatus" is not null and "completedAt" is not null));`);
    this.addSql(`alter table "api_idempotency_record" add constraint "CHK_api_idempotency_response_storage" check (not ("responseBody" is not null and "sensitiveResponseEnvelope" is not null));`);

    this.addSql(`alter table "audit_log" add constraint "CHK_audit_log_credential_type" check ("credentialType" in ('session', 'api_key', 'machine_dpop', 'edge_session', 'health_key', 'system'));`);
    this.addSql(`alter table "audit_log" add constraint "CHK_audit_log_actor_type" check ("actorType" in ('human', 'machine', 'edge', 'health_check', 'system'));`);
    this.addSql(`create or replace function "audit_log_audit_log_immutable_fn"() returns trigger as \$\$ begin if OLD."statusCode" is not null then
			raise exception 'Finalized audit logs are immutable.'
				using errcode = 'integrity_constraint_violation'; 		end if; 		return NEW; end; \$\$ language plpgsql;`);
    this.addSql(`create trigger "audit_log_immutable" BEFORE UPDATE on "audit_log" for each ROW execute function "audit_log_audit_log_immutable_fn"();`);

    this.addSql(`alter table "billing_ledger_account" add constraint "CHK_billing_ledger_account_code" check ("accountCode" in ('customer_credit', 'platform_markup_pending', 'platform_markup_revenue', 'platform_service_revenue', 'platform_qualification_expense', 'host_earnings_pending', 'host_earnings_credited', 'escrow_custody', 'escrow_withdrawal_pending', 'escrow_host_credited', 'escrow_fees_accrued', 'escrow_frozen', 'platform_wallet'));`);
    this.addSql(`alter table "billing_ledger_account" add constraint "CHK_billing_ledger_account_owner" check ("ownerKind" in ('organization', 'platform'));`);
    this.addSql(`alter table "billing_ledger_account" add constraint "CHK_billing_ledger_account_currency" check ("currency" in ('USD'));`);
    this.addSql(`create or replace function "billing_ledger_account_billing_ledger_immutable_fn"() returns trigger as \$\$ begin raise exception 'Posted billing ledger records are immutable.'
			using errcode = 'integrity_constraint_violation'; end; \$\$ language plpgsql;`);
    this.addSql(`create trigger "billing_ledger_immutable" BEFORE UPDATE OR DELETE on "billing_ledger_account" for each ROW execute function "billing_ledger_account_billing_ledger_immutable_fn"();`);

    this.addSql(`alter table "billing_ledger_transaction" add constraint "CHK_billing_ledger_transaction_version" check ("sourceVersion" > 0);`);
    this.addSql(`create or replace function "billing_ledger_balance_guard_fn"() returns trigger as \$\$declare
	ledger_transaction_id uuid; 	entry_count bigint; 	debit_total numeric; 	credit_total numeric; begin
	if TG_TABLE_NAME = 'billing_ledger_transaction' then
		ledger_transaction_id := NEW.id; 	else
		ledger_transaction_id := NEW."transactionId"; 	end if; 	select count(*),
		coalesce(sum(entry.amount) filter (where entry.side = 'debit'), 0),
		coalesce(sum(entry.amount) filter (where entry.side = 'credit'), 0)
	into entry_count, debit_total, credit_total
	from "billing_ledger_entry" entry
	where entry."transactionId" = ledger_transaction_id; 	if entry_count < 2 or debit_total <> credit_total then
		raise exception 'Billing ledger transaction % is incomplete or unbalanced.', ledger_transaction_id
			using errcode = 'check_violation'; 	end if; 	return null; end; \$\$ language plpgsql;`);
    this.addSql(`create constraint trigger "billing_ledger_transaction_balanced" after insert on "billing_ledger_transaction"
	deferrable initially deferred for each row execute function "billing_ledger_balance_guard_fn"();`);
    this.addSql(`create or replace function "billing_ledger_transaction_billing_ledger_immutable_fn"() returns trigger as \$\$ begin raise exception 'Posted billing ledger records are immutable.'
			using errcode = 'integrity_constraint_violation'; end; \$\$ language plpgsql;`);
    this.addSql(`create trigger "billing_ledger_immutable" BEFORE UPDATE OR DELETE on "billing_ledger_transaction" for each ROW execute function "billing_ledger_transaction_billing_ledger_immutable_fn"();`);

    this.addSql(`alter table "billing_ledger_entry" add constraint "FK_billing_ledger_entry_transaction" foreign key ("transactionId") references "billing_ledger_transaction" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "billing_ledger_entry" add constraint "FK_billing_ledger_entry_account" foreign key ("accountId") references "billing_ledger_account" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "billing_ledger_entry" add constraint "CHK_billing_ledger_entry_amount" check (amount > 0);`);
    this.addSql(`alter table "billing_ledger_entry" add constraint "CHK_billing_ledger_entry_side" check ("side" in ('debit', 'credit'));`);
    this.addSql(`alter table "billing_ledger_entry" add constraint "CHK_billing_ledger_entry_number" check ("entryNumber" >= 0);`);
    this.addSql(`create or replace function "billing_ledger_balance_guard_fn"() returns trigger as \$\$declare
	ledger_transaction_id uuid; 	entry_count bigint; 	debit_total numeric; 	credit_total numeric; begin
	if TG_TABLE_NAME = 'billing_ledger_transaction' then
		ledger_transaction_id := NEW.id; 	else
		ledger_transaction_id := NEW."transactionId"; 	end if; 	select count(*),
		coalesce(sum(entry.amount) filter (where entry.side = 'debit'), 0),
		coalesce(sum(entry.amount) filter (where entry.side = 'credit'), 0)
	into entry_count, debit_total, credit_total
	from "billing_ledger_entry" entry
	where entry."transactionId" = ledger_transaction_id; 	if entry_count < 2 or debit_total <> credit_total then
		raise exception 'Billing ledger transaction % is incomplete or unbalanced.', ledger_transaction_id
			using errcode = 'check_violation'; 	end if; 	return null; end; \$\$ language plpgsql;`);
    this.addSql(`create constraint trigger "billing_ledger_entry_balanced" after insert on "billing_ledger_entry"
	deferrable initially deferred for each row execute function "billing_ledger_balance_guard_fn"();`);
    this.addSql(`create or replace function "billing_ledger_entry_billing_ledger_immutable_fn"() returns trigger as \$\$ begin raise exception 'Posted billing ledger records are immutable.'
			using errcode = 'integrity_constraint_violation'; end; \$\$ language plpgsql;`);
    this.addSql(`create trigger "billing_ledger_immutable" BEFORE UPDATE OR DELETE on "billing_ledger_entry" for each ROW execute function "billing_ledger_entry_billing_ledger_immutable_fn"();`);

    this.addSql(`alter table "network_edge" add constraint "CHK_network_edge_supported_protocols" check (cardinality("supportedProtocols") > 0 AND "supportedProtocols" <@ ARRAY['http', 'tcp', 'udp']::text[]);`);
    this.addSql(`alter table "network_edge" add constraint "CHK_network_edge_status" check ("status" IN ('enrolling', 'active', 'draining', 'disabled'));`);
    this.addSql(`alter table "network_edge" add constraint "CHK_network_edge_route_publication" check (("routeTablePublishedVersion" is null) = ("routeTablePublishedDigest" is null));`);
    this.addSql(`alter table "network_edge" add constraint "CHK_network_edge_usage_epoch" check ("usageEpoch" >= 0);`);
    this.addSql(`alter table "network_edge" add constraint "CHK_network_edge_session_generation" check ("sessionGeneration" >= 0);`);
    this.addSql(`alter table "network_edge" add constraint "CHK_network_edge_credential_generation" check ("credentialGeneration" > 0);`);

    this.addSql(`alter table "network_edge_session" add constraint "FK_network_edge_session_edge" foreign key ("edgeId") references "network_edge" ("id") on delete cascade;`);
    this.addSql(`alter table "network_edge_session" add constraint "CHK_network_edge_session_replacement_grace" check ("replacementGraceExpiresAt" is null or "replacementGraceExpiresAt" <= "expiresAt");`);
    this.addSql(`alter table "network_edge_session" add constraint "CHK_network_edge_session_generation" check ("generation" > 0);`);

    this.addSql(`alter table "edge_usage_checkpoint" add constraint "FK_edge_usage_checkpoint_edge" foreign key ("edgeId") references "network_edge" ("id") on delete restrict;`);
    this.addSql(`alter table "edge_usage_checkpoint" add constraint "CHK_edge_usage_checkpoint_interval" check ("intervalEndedAt" > "intervalStartedAt");`);
    this.addSql(`alter table "edge_usage_checkpoint" add constraint "CHK_edge_usage_checkpoint_session_generation" check ("edgeSessionGeneration" > 0);`);
    this.addSql(`alter table "edge_usage_checkpoint" add constraint "CHK_edge_usage_checkpoint_usage_epoch" check ("usageEpoch" > 0);`);
    this.addSql(`alter table "edge_usage_checkpoint" add constraint "CHK_edge_usage_checkpoint_sequence" check ("sequence" > 0);`);

    this.addSql(`alter table "escrow_account" add constraint "CHK_escrow_account_amounts" check ("freeMicroUsd" >= 0 and "pendingMicroUsd" >= 0 and "hostBalanceMicroUsd" >= 0 and "hostWithdrawnMicroUsd" >= 0 and "feesAccruedMicroUsd" >= 0 and "frozenMicroUsd" >= 0);`);

    this.addSql(`alter table "escrow_auto_top_up" add constraint "CHK_escrow_auto_top_up_amounts" check ("amountMicroUsd" > 0 and "thresholdMicroUsd" > 0 and "maxRelayFeeMicroUsd" >= 0 and "minIntervalSeconds" > 0);`);

    this.addSql(`alter table "job" add constraint "CHK_job_assignment_generation" check ("assignmentGeneration" is null or "assignmentGeneration" > 0);`);
    this.addSql(`alter table "job" add constraint "CHK_job_active_lease" check (status <> 'in_progress' or ("leaseToken" is not null and "leaseExpiresAt" is not null and "leasedBySessionId" is not null and attempt > 0));`);
    this.addSql(`alter table "job" add constraint "CHK_job_attempt_bounds" check (attempt >= 0 and "maxAttempts" > 0 and attempt <= "maxAttempts");`);

    this.addSql(`alter table "machine_workload_outcome" add constraint "CHK_machine_workload_outcome_subject" check ("subjectKind" in ('workload', 'customer'));`);
    this.addSql(`alter table "machine_workload_outcome" add constraint "CHK_machine_workload_outcome_class" check ("outcomeClass" in ('success', 'failure'));`);

    this.addSql(`alter table "realtime_outbox_event" add constraint "CHK_realtime_outbox_event_status" check (status in ('pending', 'processing', 'published', 'failed'));`);

    this.addSql(`alter table "sanctioned_address" add constraint "CHK_sanctioned_address_lowercase" check ("address" = lower("address"));`);

    this.addSql(`alter table "sanctions_list_sync" add constraint "CHK_sanctions_list_sync_single_row" check ("id" = 1);`);

    this.addSql(`alter table "sanctions_pending_alert" add constraint "CHK_sanctions_pending_alert_purpose" check ("purpose" in ('funding', 'payout'));`);
    this.addSql(`alter table "sanctions_pending_alert" add constraint "CHK_sanctions_pending_alert_kind" check ("kind" in ('sanctions-match', 'sanctions-delisted'));`);

    this.addSql(`alter table "sandbox_connection_record" add constraint "CHK_sandbox_connection_record_workload_kind" check ("workloadKind" in ('sandbox', 'builder'));`);
    this.addSql(`alter table "sandbox_connection_record" add constraint "CHK_sandbox_connection_record_protocol" check ("protocol" in ('tcp', 'udp', 'icmp'));`);

    this.addSql(`alter table "twoFactor" add constraint "two_factor_user_id_fk" foreign key ("userId") references "user" ("id") on delete cascade;`);

    this.addSql(`alter table "session" add constraint "session_user_id_fk" foreign key ("userId") references "user" ("id") on delete cascade;`);

    this.addSql(`alter table "passkey" add constraint "passkey_user_id_fk" foreign key ("userId") references "user" ("id") on delete cascade;`);

    this.addSql(`alter table "organization" add constraint "organization_createdBy_fk" foreign key ("createdBy") references "user" ("id") on delete set null;`);

    this.addSql(`alter table "storage_charge" add constraint "FK_storage_charge_organization" foreign key ("organizationId") references "organization" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "storage_charge" add constraint "CHK_storage_charge_amounts" check ("storedBytes" >= 0 and "amountMicroUsd" >= 0);`);

    this.addSql(`alter table "snapshot" add constraint "FK_snapshot_organization" foreign key ("organizationId") references "organization" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "snapshot" add constraint "snapshot_buildInfoSnapshotRef_fk" foreign key ("buildInfoSnapshotRef") references "build_info" ("snapshotRef") on update no action on delete no action;`);

    this.addSql(`alter table "settings" add constraint "settings_spotCheckOrganizationId_fk" foreign key ("spotCheckOrganizationId") references "organization" ("id") on delete restrict;`);
    this.addSql(`alter table "settings" add constraint "CHK_settings_version" check ("resourceVersion" > 0);`);
    this.addSql(`alter table "settings" add constraint "CHK_settings_sandbox_class" check ("defaultSandboxClass" in ('linux_vm'));`);
    this.addSql(`alter table "settings" add constraint "CHK_settings_draining_mode" check ("drainingMode" in ('migrate', 'archive'));`);
    this.addSql(`alter table "settings" add constraint "CHK_settings_markup" check ("markupBasisPoints" <= 4287);`);
    this.addSql(`alter table "settings" add constraint "CHK_settings_abuse_enforcement_mode" check ("abuseEnforcementMode" in ('observe', 'enforce'));`);
    this.addSql(`alter table "settings" add constraint "CHK_settings_sandbox_traffic" check ("sandboxUploadBandwidthLimitMbps" between 1 and 32000 and "sandboxDownloadBandwidthLimitMbps" between 1 and 32000 and "sandboxBurstMib" between 0 and 1024 and "sandboxPacketsPerSecondLimit" between 1000 and 1000000 and "sandboxNewConnectionsPerSecond" between 1 and 10000 and "sandboxMaxConnections" between 64 and 262144 and "sandboxHostLinkShareBasisPoints" between 1000 and 10000);`);
    this.addSql(`alter table "settings" add constraint "CHK_settings_archive_after_stopped_days" check ("archiveAfterStoppedDaysDefault" between 0 and 30);`);
    this.addSql(`alter table "settings" add constraint "CHK_settings_basis_points" check ("verifiedMinimumUptimeBasisPoints" <= 10000 and "spotCheckToleranceBasisPoints" <= 10000);`);
    this.addSql(`alter table "settings" add constraint "CHK_settings_positive" check ("priceLockDays" >= 1 and "startWaitMinutes" >= 1 and "delegatedSignerMinimumHourlyCapCents" >= 1 and "exposureCeilingProbationaryCents" >= 1 and "exposureCeilingEstablishedCents" >= 1 and "exposureCeilingHostCents" >= 1 and "voucherIntervalSeconds" >= 1 and "voucherGraceIntervals" >= 1 and "storageCapGibDefault" >= 1 and "walletFeeCapBasisPoints" >= 1 and "archiveAfterMachineOfflineMinutes" >= 1 and "fundsStopMarginMinutes" >= 1);`);
    this.addSql(`alter table "settings" add constraint "CHK_settings_non_negative" check ("maxCpuPerSandbox" >= 0 and "maxMemoryPerSandbox" >= 0 and "maxDiskPerSandbox" >= 0 and "markupBasisPoints" >= 0 and "listingMinimumDownlinkMbps" >= 0 and "listingMinimumUplinkMbps" >= 0 and "listingMinimumDiskRandomReadIops" >= 0 and "listingMinimumDiskSequentialMibps" >= 0 and "verifiedMinimumListedDays" >= 0 and "verifiedMinimumUptimeBasisPoints" >= 0 and "verifiedMinimumSpotChecks" >= 0 and "spotCheckIntervalHoursCommunity" >= 0 and "spotCheckIntervalHoursVerified" >= 0 and "spotCheckMonthlyBudgetCents" >= 0 and "spotCheckToleranceBasisPoints" >= 0 and "settlementConfirmations" >= 0 and "largeDepositConfirmations" >= 0 and "largeDepositThresholdCents" >= 0 and "hostPayoutMinimumCents" >= 0 and "minimumDepositCents" >= 0 and "storageMicroUsdPerGibMonth" >= 0 and "relayFeeMarginBasisPoints" >= 0);`);
    this.addSql(`alter table "settings" add constraint "CHK_settings_singleton" check ("id" = 1);`);

    this.addSql(`alter table "secret" add constraint "FK_secret_organization" foreign key ("organizationId") references "organization" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "secret" add constraint "CHK_secret_principal_type" check ("createdByPrincipalType" in ('human'));`);
    this.addSql(`alter table "secret" add constraint "CHK_secret_resource_version" check ("resourceVersion" > 0);`);
    this.addSql(`alter table "secret" add constraint "CHK_secret_current_version" check ("currentVersion" > 0);`);

    this.addSql(`alter table "secret_version" add constraint "FK_secret_version_secret" foreign key ("secretId", "organizationId") references "secret" ("id", "organizationId") on update no action on delete restrict;`);
    this.addSql(`alter table "secret_version" add constraint "CHK_secret_version_principal_type" check ("createdByPrincipalType" in ('human'));`);
    this.addSql(`alter table "secret_version" add constraint "CHK_secret_version_resource_version" check ("resourceVersion" > 0);`);
    this.addSql(`alter table "secret_version" add constraint "CHK_secret_version_positive" check ("version" > 0);`);

    this.addSql(`alter table "payment_wallet" add constraint "FK_payment_wallet_organization" foreign key ("organizationId") references "organization" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "payment_wallet" add constraint "CHK_payment_wallet_sanctions_status" check ("sanctionsStatus" in ('clear', 'blocked', 'unchecked'));`);
    this.addSql(`alter table "payment_wallet" add constraint "CHK_payment_wallet_purpose" check ("purpose" in ('funding', 'payout'));`);

    this.addSql(`alter table "payment_channel" add constraint "FK_payment_channel_customer_organization" foreign key ("customerOrganizationId") references "organization" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "payment_channel" add constraint "FK_payment_channel_host_organization" foreign key ("hostOrganizationId") references "organization" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "payment_channel" add constraint "CHK_payment_channel_amounts" check ("feeBps" >= 0 and "chargedMicroUsd" >= 0 and "issuedMicroUsd" >= 0 and "signedMicroUsd" >= 0 and "claimedMicroUsd" >= 0 and "refundedMicroUsd" >= 0 and "signedMicroUsd" <= "issuedMicroUsd");`);
    this.addSql(`alter table "payment_channel" add constraint "CHK_payment_channel_voucher_error" check ("voucherError" is null or "voucherError" in ('customer_balance', 'signer_cap', 'signer_missing', 'signer_thawing', 'signer_revoked', 'signer_expired', 'signer_scope'));`);
    this.addSql(`alter table "payment_channel" add constraint "CHK_payment_channel_signing_mode" check ("signingMode" in ('delegated', 'client'));`);
    this.addSql(`alter table "payment_channel" add constraint "CHK_payment_channel_kind" check (("kind" = 'sandbox' and "machineId" is not null and "hostOrganizationId" is not null)
		or ("kind" = 'platform' and "machineId" is null and "hostOrganizationId" is null));`);

    this.addSql(`alter table "payment_voucher" add constraint "FK_payment_voucher_channel" foreign key ("paymentChannelId") references "payment_channel" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "payment_voucher" add constraint "CHK_payment_voucher_signature" check (("signature" is null) = ("signerAddress" is null) and ("signature" is null) = ("signedAt" is null));`);
    this.addSql(`alter table "payment_voucher" add constraint "CHK_payment_voucher_amount" check ("sequence" > 0 and "cumulativeMicroUsd" > 0);`);

    this.addSql(`alter table "payment_channel_refund" add constraint "FK_payment_channel_refund_channel" foreign key ("paymentChannelId") references "payment_channel" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "payment_channel_refund" add constraint "FK_payment_channel_refund_user" foreign key ("refundedByUserId") references "user" ("id") on update no action on delete set null;`);
    this.addSql(`alter table "payment_channel_refund" add constraint "CHK_payment_channel_refund_amount" check ("amountMicroUsd" > 0);`);

    this.addSql(`alter table "organizationRole" add constraint "organizationRole_organizationId_fk" foreign key ("organizationId") references "organization" ("id") on delete cascade;`);

    this.addSql(`alter table "organization_quota_increase_request" add constraint "FK_quota_increase_request_organization" foreign key ("organizationId") references "organization" ("id") on delete cascade;`);
    this.addSql(`alter table "organization_quota_increase_request" add constraint "FK_quota_increase_request_requested_by" foreign key ("requestedBy") references "user" ("id") on delete set null;`);
    this.addSql(`alter table "organization_quota_increase_request" add constraint "FK_quota_increase_request_reviewed_by" foreign key ("reviewedBy") references "user" ("id") on delete set null;`);
    this.addSql(`alter table "organization_quota_increase_request" add constraint "CHK_quota_increase_request_amounts" check ("requestedCpu" >= 0 and "requestedMemory" >= 0 and "requestedDisk" >= 0 and "requestedGpu" >= 0);`);
    this.addSql(`alter table "organization_quota_increase_request" add constraint "CHK_quota_increase_request_review" check (("status" = 'pending') = ("reviewedAt" is null));`);
    this.addSql(`alter table "organization_quota_increase_request" add constraint "CHK_quota_increase_request_sandbox_class" check ("sandboxClass" in ('linux_vm'));`);
    this.addSql(`alter table "organization_quota_increase_request" add constraint "CHK_quota_increase_request_status" check ("status" in ('pending', 'approved', 'denied'));`);

    this.addSql(`alter table "organization_quota" add constraint "organization_quota_organizationId_fk" foreign key ("organizationId") references "organization" ("id") on delete cascade;`);

    this.addSql(`alter table "organization_limits" add constraint "organization_limits_organizationId_fk" foreign key ("organizationId") references "organization" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "organization_limits" add constraint "CHK_organization_limits_archive_after_stopped_days" check ("archiveAfterStoppedDays" is null or "archiveAfterStoppedDays" between 0 and 30);`);

    this.addSql(`alter table "organization_funding" add constraint "FK_organization_funding_organization" foreign key ("organizationId") references "organization" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "organization_funding" add constraint "CHK_organization_funding_runway_warning" check ("runwayWarning" is null or "runwayWarning" in ('day', 'hour'));`);

    this.addSql(`alter table "machine" add constraint "FK_machine_organization" foreign key ("organizationId") references "organization" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "machine" add constraint "FK_machine_latest_benchmark" foreign key ("latestBenchmarkId") references "machine_benchmark" ("id") on update no action on delete set null;`);
    this.addSql(`alter table "machine" add constraint "CHK_machine_max_unclaimed_float" check ("maxUnclaimedFloat" is null or "maxUnclaimedFloat" between 1 and 1000000000000);`);
    this.addSql(`alter table "machine" add constraint "CHK_machine_offer" check (("offeredVcpus" is null or "offeredVcpus" between 1 and 1024) and ("offeredMemoryGib" is null or "offeredMemoryGib" between 1 and 16384) and ("offeredDiskGib" is null or "offeredDiskGib" between 1 and 1048576));`);
    this.addSql(`alter table "machine" add constraint "CHK_machine_maintenance_window" check (("maintenanceWindowStartMinute" is null and "maintenanceWindowDurationMinutes" is null) or ("maintenanceWindowStartMinute" between 0 and 1439 and "maintenanceWindowDurationMinutes" between 60 and 720));`);
    this.addSql(`alter table "machine" add constraint "CHK_machine_gpu_type" check ("gpuType" is null or "gpuType" in ('h100', 'rtx_pro_6000'));`);
    this.addSql(`alter table "machine" add constraint "CHK_machine_category" check ("category" is null or "category" in ('general', 'high_memory', 'gpu'));`);
    this.addSql(`alter table "machine" add constraint "CHK_machine_admin_tier_cap" check ("adminTierCap" is null or "adminTierCap" in ('private', 'community', 'verified', 'datacenter'));`);
    this.addSql(`alter table "machine" add constraint "CHK_machine_tier" check ("tier" in ('private', 'community', 'verified', 'datacenter'));`);
    this.addSql(`alter table "machine" add constraint "CHK_machine_gpu" check (("gpuCount" = 0 and "gpuType" is null) or ("gpuCount" > 0 and "gpuType" is not null));`);

    this.addSql(`alter table "machine_session" add constraint "FK_machine_session_machine" foreign key ("machineId") references "machine" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "machine_session" add constraint "CHK_machine_session_generation" check ("generation" > 0);`);

    this.addSql(`alter table "machine_qualification_challenge" add constraint "FK_machine_qualification_challenge_machine" foreign key ("machineId") references "machine" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "machine_qualification_challenge" add constraint "FK_machine_qualification_challenge_session" foreign key ("machineSessionId") references "machine_session" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "machine_qualification_challenge" add constraint "FK_machine_qualification_challenge_job" foreign key ("jobId") references "job" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "machine_qualification_challenge" add constraint "CHK_machine_qualification_canary_credit" check ("canaryCreditMicroUsd" >= 0);`);
    this.addSql(`alter table "machine_qualification_challenge" add constraint "CHK_machine_qualification_challenge_expiry" check ("expiresAt" > "issuedAt");`);
    this.addSql(`alter table "machine_qualification_challenge" add constraint "CHK_machine_qualification_challenge_state" check ("state" in ('pending', 'accepted', 'rejected', 'expired'));`);
    this.addSql(`alter table "machine_qualification_challenge" add constraint "CHK_machine_qualification_challenge_versions" check ("schemaVersion" > 0 and "policyVersion" > 0 and "machineSessionGeneration" > 0);`);

    this.addSql(`alter table "machine_qualification_evidence" add constraint "FK_machine_qualification_evidence_challenge" foreign key ("challengeId") references "machine_qualification_challenge" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "machine_qualification_evidence" add constraint "CHK_machine_qualification_evidence_policy" check ("evaluatorPolicyVersion" > 0);`);
    this.addSql(`alter table "machine_qualification_evidence" add constraint "CHK_machine_qualification_evidence_verdict" check ("verdict" in ('accepted', 'rejected'));`);

    this.addSql(`alter table "machine_public_address" add constraint "FK_machine_public_address_machine" foreign key ("machineId") references "machine" ("id") on update no action on delete cascade;`);

    this.addSql(`alter table "machine_observation" add constraint "FK_machine_observation_machine" foreign key ("machineId") references "machine" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "machine_observation" add constraint "FK_machine_observation_session" foreign key ("sessionId") references "machine_session" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "machine_observation" add constraint "CHK_machine_observation_generation" check ("generation" > 0);`);

    this.addSql(`alter table "machine_host_key" add constraint "FK_machine_host_key_machine" foreign key ("machineId") references "machine" ("id") on update no action on delete cascade;`);

    this.addSql(`alter table "machine_health_gap" add constraint "FK_machine_health_gap_machine" foreign key ("machineId") references "machine" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "machine_health_gap" add constraint "CHK_machine_health_gap_order" check ("endAt" > "startAt");`);

    this.addSql(`alter table "machine_fingerprint_component" add constraint "FK_machine_fingerprint_component_machine" foreign key ("machineId") references "machine" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "machine_fingerprint_component" add constraint "CHK_machine_fingerprint_component_kind" check ("kind" in ('smbios_uuid', 'board_serial', 'disk_serial', 'gpu_uuid'));`);

    this.addSql(`alter table "machine_edge_binding" add constraint "FK_machine_edge_binding_machine" foreign key ("machineId") references "machine" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "machine_edge_binding" add constraint "FK_machine_edge_binding_edge" foreign key ("edgeId") references "network_edge" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "machine_edge_binding" add constraint "CHK_machine_edge_binding_carrier" check ("observedCarrier" IS NULL OR "observedCarrier" IN ('quic', 'http2'));`);
    this.addSql(`alter table "machine_edge_binding" add constraint "CHK_machine_edge_binding_loss" check ("observedLossRatio" is null or ("observedLossRatio"::numeric >= 0 and "observedLossRatio"::numeric <= 1));`);
    this.addSql(`alter table "machine_edge_binding" add constraint "CHK_machine_edge_binding_rtt" check ("observedRttMilliseconds" is null or "observedRttMilliseconds"::numeric >= 0);`);
    this.addSql(`alter table "machine_edge_binding" add constraint "CHK_machine_edge_binding_observed_state" check ("observedState" IN ('pending', 'active', 'replacing', 'draining', 'failed', 'released'));`);
    this.addSql(`alter table "machine_edge_binding" add constraint "CHK_machine_edge_binding_desired_state" check ("desiredState" IN ('active', 'draining', 'released'));`);
    this.addSql(`alter table "machine_edge_binding" add constraint "CHK_machine_edge_binding_session_generation" check ("machineSessionGeneration" > 0);`);
    this.addSql(`alter table "machine_edge_binding" add constraint "CHK_machine_edge_binding_target_revision" check ("targetRevision" > 0);`);
    this.addSql(`alter table "machine_edge_binding" add constraint "CHK_machine_edge_binding_revision" check ("revision" > 0);`);

    this.addSql(`alter table "machine_connection_coverage" add constraint "FK_machine_connection_coverage_machine" foreign key ("machineId") references "machine" ("id") on update no action on delete cascade;`);

    this.addSql(`alter table "machine_benchmark" add constraint "FK_machine_benchmark_machine" foreign key ("machineId") references "machine" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "machine_benchmark" add constraint "CHK_machine_benchmark_shape" check ("suiteVersion" > 0 and "cpu" > 0 and "memoryGib" > 0 and "gpu" >= 0 and ("diskGib" > 0 or "state" = 'deferred'));`);
    this.addSql(`alter table "machine_benchmark" add constraint "CHK_machine_benchmark_attempt" check ("attempt" > 0);`);
    this.addSql(`alter table "machine_benchmark" add constraint "CHK_machine_benchmark_window" check ("challengeExpiresAt" > "issuedAt");`);
    this.addSql(`alter table "machine_benchmark" add constraint "CHK_machine_benchmark_validity" check (("state" = 'passed') = ("validUntil" is not null));`);
    this.addSql(`alter table "machine_benchmark" add constraint "CHK_machine_benchmark_deferral" check (("state" = 'deferred') = ("deferralReason" is not null and "nextAttemptAt" is not null));`);
    this.addSql(`alter table "machine_benchmark" add constraint "CHK_machine_benchmark_deferral_reason" check ("deferralReason" is null or "deferralReason" in ('machine_busy', 'insufficient_capacity', 'deadline_exceeded', 'speedtest_unavailable', 'challenge_expired', 'retryable_failure'));`);
    this.addSql(`alter table "machine_benchmark" add constraint "CHK_machine_benchmark_state" check ("state" in ('pending', 'passed', 'deferred', 'failed'));`);
    this.addSql(`alter table "machine_benchmark" add constraint "CHK_machine_benchmark_trigger" check ("trigger" in ('registration', 'inventory_change', 'release_change', 'retry', 'renewal', 'host_request', 'admin_request'));`);

    this.addSql(`alter table "machine_assessment" add constraint "FK_machine_assessment_machine" foreign key ("machineId") references "machine" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "machine_assessment" add constraint "CHK_machine_assessment_restriction_reason" check ("restrictionReason" is null or "restrictionReason" in ('reliability_degraded', 'usage_attestation_insufficient', 'evidence_quarantined'));`);
    this.addSql(`alter table "machine_assessment" add constraint "CHK_machine_assessment_health" check ("healthBasisPoints" >= 0 and "healthBasisPoints" <= 10000);`);
    this.addSql(`alter table "machine_assessment" add constraint "CHK_machine_assessment_uptime" check ("uptimeBasisPoints" >= 0 and "uptimeBasisPoints" <= 10000);`);
    this.addSql(`alter table "machine_assessment" add constraint "CHK_machine_assessment_attestation" check ("attestationBasisPoints" >= 0 and "attestationBasisPoints" <= 10000);`);
    this.addSql(`alter table "machine_assessment" add constraint "CHK_machine_assessment_placement_evidence" check ("successMass" >= '0'::double precision and "failureMass" >= '0'::double precision and "placementWindow" >= 1);`);
    this.addSql(`alter table "machine_assessment" add constraint "CHK_machine_assessment_sample_counts" check ("successfulSamples" >= 0 and "machineAttributableFailures" >= 0 and "unattributedFailureCount" >= 0 and "neutralEventCount" >= 0 and "quarantinedLineCount" >= 0 and "reconciledWindowCount" >= 0 and "relapseCount" >= 0 and "platformObservedEventCount" >= 0);`);
    this.addSql(`alter table "machine_assessment" add constraint "CHK_machine_assessment_trust_stage" check ("trustStage" in ('probationary', 'established', 'restricted', 'recovering'));`);
    this.addSql(`alter table "machine_assessment" add constraint "CHK_machine_assessment_reliability" check ("reliabilityBasisPoints" >= 0 and "reliabilityBasisPoints" <= 10000);`);

    this.addSql(`alter table "host_settlement" add constraint "FK_host_settlement_machine" foreign key ("machineId") references "machine" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "host_settlement" add constraint "CHK_host_settlement_relay_fee" check ("relayFeeMicroUsd" >= 0);`);
    this.addSql(`alter table "host_settlement" add constraint "CHK_host_settlement_status" check ("status" in ('queued', 'sent', 'succeeded', 'failed'));`);

    this.addSql(`alter table "host_profile" add constraint "FK_host_profile_organization" foreign key ("organizationId") references "organization" ("id") on update no action on delete cascade;`);

    this.addSql(`alter table "escrow_event" add constraint "FK_escrow_event_customer_organization" foreign key ("customerOrganizationId") references "organization" ("id") on update no action on delete set null;`);
    this.addSql(`alter table "escrow_event" add constraint "FK_escrow_event_host_organization" foreign key ("hostOrganizationId") references "organization" ("id") on update no action on delete set null;`);
    this.addSql(`alter table "escrow_event" add constraint "CHK_escrow_event_kind" check ("kind" in ('AccountBlocked', 'AccountUnblocked', 'AutoTopUpDisabled', 'AutoTopUpExecuted', 'AutoTopUpSet', 'ClaimResult', 'Claimed', 'ClaimsFreezeRearmed', 'ClaimsFrozen', 'DefaultAdminDelayChangeCanceled', 'DefaultAdminDelayChangeScheduled', 'DefaultAdminTransferCanceled', 'DefaultAdminTransferScheduled', 'DepositCapsSet', 'Deposited', 'EIP712DomainChanged', 'FeesSwept', 'Frozen', 'FrozenReleased', 'HostWithdrawn', 'Paused', 'PayoutAddressSet', 'RelayFeePaid', 'RoleAdminChanged', 'RoleGranted', 'RoleRevoked', 'SignerAuthorized', 'SignerLimitLowerScheduled', 'SignerLimitRaised', 'SignerRevoked', 'SignerThawed', 'SurplusRecovered', 'Unpaused', 'WithdrawalCancelled', 'WithdrawalRequested', 'Withdrawn'));`);

    this.addSql(`alter table "docker_registry" add constraint "docker_registry_organizationId_fk" foreign key ("organizationId") references "organization" ("id") on delete restrict;`);

    this.addSql(`alter table "delegated_signer" add constraint "FK_delegated_signer_organization" foreign key ("organizationId") references "organization" ("id") on update no action on delete restrict;`);

    this.addSql(`alter table "signature_audit" add constraint "FK_signature_audit_delegated_signer" foreign key ("delegatedSignerId") references "delegated_signer" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "signature_audit" add constraint "FK_signature_audit_voucher" foreign key ("voucherId") references "payment_voucher" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "signature_audit" add constraint "CHK_signature_audit_kind" check ("kind" in ('voucher', 'signer_proof'));`);

    this.addSql(`alter table "billing_receipt" add constraint "FK_billing_receipt_organization" foreign key ("organizationId") references "organization" ("id") on update no action on delete cascade;`);

    this.addSql(`alter table "billing_profile" add constraint "FK_billing_profile_organization" foreign key ("organizationId") references "organization" ("id") on update no action on delete cascade;`);

    this.addSql(`alter table "billing_budget_version" add constraint "FK_billing_budget_version_organization" foreign key ("organizationId") references "organization" ("id") on update no action on delete restrict;`);

    this.addSql(`alter table "billing_budget" add constraint "billing_budget_organizationId_fkey" foreign key ("organizationId") references "organization" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "billing_budget" add constraint "CHK_billing_budget_warning" check ("warningThresholdBasisPoints" >= 1 and "warningThresholdBasisPoints" <= 10000);`);
    this.addSql(`alter table "billing_budget" add constraint "CHK_billing_budget_mode" check (mode in ('alert', 'block_new'));`);
    this.addSql(`alter table "billing_budget" add constraint "CHK_billing_budget_amounts" check ("monthlyLimitMicroUsd" > 0);`);
    this.addSql(`alter table "billing_budget" add constraint "CHK_billing_budget_version" check ("resourceVersion" > 0);`);

    this.addSql(`alter table "auto_top_up" add constraint "FK_auto_top_up_organization" foreign key ("organizationId") references "organization" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "auto_top_up" add constraint "CHK_auto_top_up_settings" check ("thresholdMicroUsd" > 0 and "amountMicroUsd" > "maxRelayFeeMicroUsd" and "maxRelayFeeMicroUsd" >= 0 and "timesPerDay" > 0);`);

    this.addSql(`alter table "apikey" add constraint "apikey_reference_id_fk" foreign key ("referenceId") references "organization" ("id") on delete cascade;`);

    this.addSql(`alter table "sandbox" add constraint "FK_sandbox_organization" foreign key ("organizationId") references "organization" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "sandbox" add constraint "FK_sandbox_api_key" foreign key ("apiKeyId") references "apikey" ("id") on update no action on delete set null;`);
    this.addSql(`alter table "sandbox" add constraint "FK_sandbox_pinned_machine" foreign key ("pinnedMachineId") references "machine" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "sandbox" add constraint "sandbox_buildInfoSnapshotRef_fk" foreign key ("buildInfoSnapshotRef") references "build_info" ("snapshotRef") on update no action on delete no action;`);
    this.addSql(`alter table "sandbox" add constraint "CHK_sandbox_voucher_signing" check ("voucherSigning" in ('delegated', 'client'));`);
    this.addSql(`alter table "sandbox" add constraint "CHK_sandbox_max_hourly_price" check ("maxHourlyPriceMicroUsd" is null or "maxHourlyPriceMicroUsd" >= 0);`);
    this.addSql(`alter table "sandbox" add constraint "CHK_sandbox_placement_minimum_tier" check ("placementMinimumTier" is null or "placementMinimumTier" in ('private', 'community', 'verified', 'datacenter'));`);
    this.addSql(`alter table "sandbox" add constraint "CHK_sandbox_placement_category" check ("placementCategory" is null or "placementCategory" in ('general', 'high_memory', 'gpu'));`);
    this.addSql(`alter table "sandbox" add constraint "CHK_sandbox_placement_kind" check ("placementKind" in ('pinned', 'flexible'));`);
    this.addSql(`alter table "sandbox" add constraint "CHK_sandbox_pin" check (("placementKind" = 'pinned') = ("pinnedMachineId" is not null));`);
    this.addSql(`alter table "sandbox" add constraint "CHK_sandbox_spec_generation" check ("specGeneration" >= 0);`);
    this.addSql(`alter table "sandbox" add constraint "CHK_sandbox_runtime_assignment" check ("runtimeLifecycle" is null or ("machineId" is not null and "runtimeSpecDigest" is not null));`);
    this.addSql(`alter table "sandbox" add constraint "CHK_sandbox_runtime_lifecycle" check ("runtimeLifecycle" is null or "runtimeLifecycle" in (1, 2, 3, 4));`);

    this.addSql(`alter table "ssh_access" add constraint "ssh_access_sandboxId_fk" foreign key ("sandboxId") references "sandbox" ("id") on update no action on delete cascade;`);

    this.addSql(`alter table "sandbox_secret_binding_set" add constraint "FK_sandbox_secret_binding_set_sandbox" foreign key ("sandboxId") references "sandbox" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "sandbox_secret_binding_set" add constraint "FK_sandbox_secret_binding_set_organization" foreign key ("organizationId") references "organization" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "sandbox_secret_binding_set" add constraint "CHK_sandbox_secret_binding_set_version" check ("resourceVersion" > 0);`);

    this.addSql(`alter table "sandbox_secret_binding" add constraint "FK_sandbox_secret_binding_sandbox" foreign key ("sandboxId", "organizationId") references "sandbox" ("id", "organizationId") on update no action on delete restrict;`);
    this.addSql(`alter table "sandbox_secret_binding" add constraint "FK_sandbox_secret_binding_secret" foreign key ("secretId", "organizationId") references "secret" ("id", "organizationId") on update no action on delete restrict;`);
    this.addSql(`alter table "sandbox_secret_binding" add constraint "FK_sandbox_secret_binding_version" foreign key ("secretVersionId", "organizationId", "secretId") references "secret_version" ("id", "organizationId", "secretId") on update no action on delete restrict;`);
    this.addSql(`alter table "sandbox_secret_binding" add constraint "CHK_sandbox_secret_binding_principal_type" check ("createdByPrincipalType" in ('human'));`);
    this.addSql(`alter table "sandbox_secret_binding" add constraint "CHK_sandbox_secret_binding_version" check ("secretVersion" > 0);`);

    this.addSql(`alter table "sandbox_placement" add constraint "FK_sandbox_placement_sandbox" foreign key ("sandboxId") references "sandbox" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "sandbox_placement" add constraint "FK_sandbox_placement_machine" foreign key ("machineId") references "machine" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "sandbox_placement" add constraint "CHK_sandbox_placement_kind" check ("placementKind" in ('pinned', 'flexible'));`);
    this.addSql(`alter table "sandbox_placement" add constraint "CHK_sandbox_placement_generation" check ("assignmentGeneration" > 0);`);
    this.addSql(`alter table "sandbox_placement" add constraint "CHK_sandbox_placement_locality" check ("locality" is null or "locality" in ('prepared', 'present', 'remote'));`);

    this.addSql(`alter table "secret_delivery_event" add constraint "FK_secret_delivery_event_sandbox" foreign key ("sandboxId") references "sandbox" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "secret_delivery_event" add constraint "FK_secret_delivery_event_placement" foreign key ("placementId") references "sandbox_placement" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "secret_delivery_event" add constraint "FK_secret_delivery_event_session" foreign key ("machineSessionId") references "machine_session" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "secret_delivery_event" add constraint "FK_secret_delivery_event_machine" foreign key ("machineId") references "machine" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "secret_delivery_event" add constraint "CHK_secret_delivery_event_outcome" check ("outcome" in ('delivered', 'rejected_revoked', 'rejected_missing'));`);

    this.addSql(`alter table "early_session_failure" add constraint "FK_early_session_failure_placement" foreign key ("placementId") references "sandbox_placement" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "early_session_failure" add constraint "FK_early_session_failure_machine" foreign key ("machineId") references "machine" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "early_session_failure" add constraint "FK_early_session_failure_customer" foreign key ("customerOrganizationId") references "organization" ("id") on update no action on delete cascade;`);

    this.addSql(`alter table "sandbox_observed_status" add constraint "FK_sandbox_observed_status_sandbox" foreign key ("sandboxId") references "sandbox" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "sandbox_observed_status" add constraint "FK_sandbox_observed_status_machine" foreign key ("machineId") references "machine" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "sandbox_observed_status" add constraint "CHK_sandbox_observed_status_generations" check ("assignmentGeneration" > 0 and "observedSpecGeneration" >= 0);`);
    this.addSql(`alter table "sandbox_observed_status" add constraint "CHK_sandbox_observed_status_state" check ("state" in (1, 2, 3, 4, 5, 6, 7));`);

    this.addSql(`alter table "sandbox_last_activity" add constraint "sandbox_last_activity_sandboxId_fk" foreign key ("sandboxId") references "sandbox" ("id") on update no action on delete cascade;`);

    this.addSql(`alter table "sandbox_fork" add constraint "sandbox_fork_parentId_fk" foreign key ("parentId") references "sandbox" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "sandbox_fork" add constraint "sandbox_fork_childId_fk" foreign key ("childId") references "sandbox" ("id") on update no action on delete cascade;`);

    this.addSql(`alter table "machine_spot_check" add constraint "FK_machine_spot_check_machine" foreign key ("machineId") references "machine" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "machine_spot_check" add constraint "FK_machine_spot_check_sandbox" foreign key ("sandboxId") references "sandbox" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "machine_spot_check" add constraint "CHK_machine_spot_check_state" check ("state" in ('scheduled', 'running', 'passed', 'failed', 'aborted'));`);

    this.addSql(`alter table "machine_reliability_event" add constraint "FK_machine_reliability_event_machine" foreign key ("machineId") references "machine" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "machine_reliability_event" add constraint "FK_machine_reliability_event_placement" foreign key ("placementId") references "sandbox_placement" ("id") on update no action on delete set null;`);
    this.addSql(`alter table "machine_reliability_event" add constraint "FK_machine_reliability_event_sandbox" foreign key ("sandboxId") references "sandbox" ("id") on update no action on delete set null;`);
    this.addSql(`alter table "machine_reliability_event" add constraint "FK_machine_reliability_event_job" foreign key ("jobId") references "job" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "machine_reliability_event" add constraint "FK_machine_reliability_event_session" foreign key ("machineSessionId") references "machine_session" ("id") on update no action on delete set null;`);
    this.addSql(`alter table "machine_reliability_event" add constraint "FK_machine_reliability_event_customer_organization" foreign key ("customerOrganizationId") references "organization" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "machine_reliability_event" add constraint "CHK_machine_reliability_event_source" check ("source" in ('machine', 'platform'));`);
    this.addSql(`alter table "machine_reliability_event" add constraint "CHK_machine_reliability_event_fault_domain" check ("faultDomain" in ('machine', 'workload', 'customer_configuration', 'control_plane', 'external', 'unknown'));`);
    this.addSql(`alter table "machine_reliability_event" add constraint "CHK_machine_reliability_event_severity" check ("severity" in ('info', 'warning', 'error'));`);
    this.addSql(`alter table "machine_reliability_event" add constraint "CHK_machine_reliability_event_outcome" check ("outcome" in ('success', 'failure', 'unattributed', 'neutral'));`);
    this.addSql(`alter table "machine_reliability_event" add constraint "CHK_machine_reliability_event_subject" check (("jobId" is not null and "jobAttempt" > 0 and "specGeneration" is null) or ("jobId" is null and "jobAttempt" is null and "specGeneration" >= 0));`);

    this.addSql(`alter table "sandbox_exposure" add constraint "FK_sandbox_exposure_organization" foreign key ("organizationId") references "organization" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "sandbox_exposure" add constraint "FK_sandbox_exposure_sandbox" foreign key ("sandboxId") references "sandbox" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "sandbox_exposure" add constraint "CHK_sandbox_exposure_observed_state" check ("observedState" IN ('pending', 'active', 'degraded', 'failed', 'deleting', 'deleted'));`);
    this.addSql(`alter table "sandbox_exposure" add constraint "CHK_sandbox_exposure_desired_state" check ("desiredState" IN ('active', 'disabled', 'deleting', 'deleted'));`);
    this.addSql(`alter table "sandbox_exposure" add constraint "CHK_sandbox_exposure_target" check (
		("kind" = 'system' AND "systemService" = 'build_logs' AND "targetHost" = 'machine-build-logs' AND (("desiredState" = 'active' AND "targetReference" IS NOT NULL) OR ("desiredState" <> 'active' AND "targetReference" IS NULL)))
		OR ("kind" = 'system' AND "systemService" = 'ssh' AND "targetHost" = 'machine-ssh-gateway' AND "targetReference" IS NULL)
		OR (NOT ("kind" = 'system' AND "systemService" IN ('build_logs', 'ssh')) AND "targetHost" = 'runtime' AND "targetReference" IS NULL)
	);`);
    this.addSql(`alter table "sandbox_exposure" add constraint "CHK_sandbox_exposure_system_lease" check (
		("kind" = 'system' AND (("desiredState" = 'active' AND "systemRequestedUntil" IS NOT NULL) OR ("desiredState" <> 'active' AND "systemRequestedUntil" IS NULL)))
		OR ("kind" <> 'system' AND "systemRequestedUntil" IS NULL)
	);`);
    this.addSql(`alter table "sandbox_exposure" add constraint "CHK_sandbox_exposure_system_service" check (
		("kind" = 'system' AND "systemService" IN ('toolbox', 'build_logs', 'terminal', 'desktop', 'ssh'))
		OR ("kind" <> 'system' AND "systemService" IS NULL)
	);`);
    this.addSql(`alter table "sandbox_exposure" add constraint "CHK_sandbox_exposure_target_port" check ("targetPort" >= 1 and "targetPort" <= 65535);`);
    this.addSql(`alter table "sandbox_exposure" add constraint "CHK_sandbox_exposure_visibility" check (
		("kind" IN ('http', 'system') AND "visibility" IN ('public', 'protected'))
		OR ("kind" IN ('tcp', 'udp') AND "visibility" IS NULL)
	);`);
    this.addSql(`alter table "sandbox_exposure" add constraint "CHK_sandbox_exposure_kind_protocol" check (
		("kind" = 'http' AND "protocol" = 'http')
		OR ("kind" = 'tcp' AND "protocol" = 'tcp')
		OR ("kind" = 'udp' AND "protocol" = 'udp')
		OR "kind" = 'system'
	);`);
    this.addSql(`alter table "sandbox_exposure" add constraint "CHK_sandbox_exposure_protocol" check ("protocol" IN ('http', 'tcp', 'udp'));`);
    this.addSql(`alter table "sandbox_exposure" add constraint "CHK_sandbox_exposure_kind" check ("kind" IN ('http', 'tcp', 'udp', 'system'));`);
    this.addSql(`alter table "sandbox_exposure" add constraint "CHK_sandbox_exposure_generation" check ("generation" > 0);`);

    this.addSql(`alter table "sandbox_exposure_reconciliation" add constraint "FK_exposure_reconciliation_exposure" foreign key ("exposureId") references "sandbox_exposure" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "sandbox_exposure_reconciliation" add constraint "CHK_exposure_reconciliation_claim" check (("claimToken" is null) = ("claimExpiresAt" is null));`);
    this.addSql(`alter table "sandbox_exposure_reconciliation" add constraint "CHK_exposure_reconciliation_attempt" check ("attempt" >= 0);`);
    this.addSql(`alter table "sandbox_exposure_reconciliation" add constraint "CHK_exposure_reconciliation_generation" check ("requestedGeneration" > 0);`);

    this.addSql(`alter table "sandbox_exposure_backend" add constraint "FK_exposure_backend_exposure" foreign key ("exposureId") references "sandbox_exposure" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "sandbox_exposure_backend" add constraint "FK_exposure_backend_placement_fence" foreign key ("placementId", "sandboxId", "machineId", "assignmentGeneration") references "sandbox_placement" ("id", "sandboxId", "machineId", "assignmentGeneration") on update no action on delete restrict;`);
    this.addSql(`alter table "sandbox_exposure_backend" add constraint "FK_exposure_backend_edge" foreign key ("edgeId") references "network_edge" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "sandbox_exposure_backend" add constraint "FK_exposure_backend_binding" foreign key ("bindingId") references "machine_edge_binding" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "sandbox_exposure_backend" add constraint "CHK_exposure_backend_public_port" check ("publicPort" is null or ("publicPort" >= 1 and "publicPort" <= 65535));`);
    this.addSql(`alter table "sandbox_exposure_backend" add constraint "CHK_exposure_backend_target_port" check ("targetPort" >= 1 and "targetPort" <= 65535);`);
    this.addSql(`alter table "sandbox_exposure_backend" add constraint "CHK_exposure_backend_cutover" check ("cutoverVerifiedAt" IS NULL OR ("cutoverStartedAt" IS NOT NULL AND "dnsActivatedAt" IS NOT NULL AND "cutoverVerifiedAt" >= "cutoverStartedAt"));`);
    this.addSql(`alter table "sandbox_exposure_backend" add constraint "CHK_exposure_backend_state" check ("state" IN ('pending', 'active', 'draining', 'failed', 'released'));`);
    this.addSql(`alter table "sandbox_exposure_backend" add constraint "CHK_exposure_backend_protocol" check ("protocol" IN ('http', 'tcp', 'udp'));`);
    this.addSql(`alter table "sandbox_exposure_backend" add constraint "CHK_exposure_backend_target_revision" check ("targetRevision" > 0);`);
    this.addSql(`alter table "sandbox_exposure_backend" add constraint "CHK_exposure_backend_binding_revision" check ("bindingRevision" > 0);`);
    this.addSql(`alter table "sandbox_exposure_backend" add constraint "CHK_exposure_backend_machine_session_generation" check ("machineSessionGeneration" > 0);`);
    this.addSql(`alter table "sandbox_exposure_backend" add constraint "CHK_exposure_backend_assignment_generation" check ("assignmentGeneration" > 0);`);
    this.addSql(`alter table "sandbox_exposure_backend" add constraint "CHK_exposure_backend_exposure_generation" check ("exposureGeneration" > 0);`);

    this.addSql(`alter table "sandbox_custom_domain" add constraint "FK_custom_domain_organization" foreign key ("organizationId") references "organization" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "sandbox_custom_domain" add constraint "FK_custom_domain_sandbox" foreign key ("sandboxId") references "sandbox" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "sandbox_custom_domain" add constraint "FK_custom_domain_exposure" foreign key ("exposureId") references "sandbox_exposure" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "sandbox_custom_domain" add constraint "CHK_sandbox_custom_domain_state" check ("state" IN ('pending', 'validating', 'active', 'failed', 'deleting'));`);
    this.addSql(`alter table "sandbox_custom_domain" add constraint "CHK_sandbox_custom_domain_observed_generation" check ("observedGeneration" >= 0);`);
    this.addSql(`alter table "sandbox_custom_domain" add constraint "CHK_sandbox_custom_domain_generation" check ("desiredGeneration" > 0);`);

    this.addSql(`alter table "api_key_budget" add constraint "FK_api_key_budget_api_key" foreign key ("apiKeyId") references "apikey" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "api_key_budget" add constraint "FK_api_key_budget_organization" foreign key ("organizationId") references "organization" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "api_key_budget" add constraint "CHK_api_key_budget_limits" check (("computeSpendLimitMicroUsd" is null or "computeSpendLimitMicroUsd" > 0) and ("maxConcurrentSandboxes" is null or "maxConcurrentSandboxes" > 0));`);

    this.addSql(`alter table "member" add constraint "member_organizationId_fk" foreign key ("organizationId") references "organization" ("id") on delete cascade;`);
    this.addSql(`alter table "member" add constraint "member_userId_fk" foreign key ("userId") references "user" ("id") on delete cascade;`);

    this.addSql(`alter table "machine_price_card" add constraint "FK_machine_price_card_machine" foreign key ("machineId") references "machine" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "machine_price_card" add constraint "FK_machine_price_card_organization" foreign key ("organizationId") references "organization" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "machine_price_card" add constraint "FK_machine_price_card_created_by" foreign key ("createdBy") references "user" ("id") on update no action on delete set null;`);
    this.addSql(`alter table "machine_price_card" add constraint "CHK_machine_price_card_version" check ("version" > 0);`);
    this.addSql(`alter table "machine_price_card" add constraint "CHK_machine_price_card_interruptible" check ("interruptibleBasisPoints" between 1 and 10000);`);
    this.addSql(`alter table "machine_price_card" add constraint "CHK_machine_price_card_gpu_rate" check (("gpuCount" > 0 and "gpuHourMicroUsd" > 0) or ("gpuCount" = 0 and "gpuHourMicroUsd" = 0));`);
    this.addSql(`alter table "machine_price_card" add constraint "CHK_machine_price_card_rates" check ("vcpuHourMicroUsd" > 0 and "memoryGibHourMicroUsd" > 0 and "diskGibMonthMicroUsd" > 0 and "vcpu" > 0 and "memoryGib" > 0 and "gpuCount" >= 0);`);
    this.addSql(`create or replace function "machine_price_card_machine_price_card_immutable_fn"() returns trigger as \$\$ begin raise exception 'Machine price cards are immutable.'
			using errcode = 'integrity_constraint_violation'; end; \$\$ language plpgsql;`);
    this.addSql(`create trigger "machine_price_card_immutable" BEFORE UPDATE OR DELETE on "machine_price_card" for each ROW execute function "machine_price_card_machine_price_card_immutable_fn"();`);

    this.addSql(`alter table "placement_price" add constraint "FK_placement_price_sandbox" foreign key ("sandboxId") references "sandbox" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "placement_price" add constraint "FK_placement_price_placement" foreign key ("placementId") references "sandbox_placement" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "placement_price" add constraint "FK_placement_price_customer_organization" foreign key ("customerOrganizationId") references "organization" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "placement_price" add constraint "FK_placement_price_host_organization" foreign key ("hostOrganizationId") references "organization" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "placement_price" add constraint "FK_placement_price_machine" foreign key ("machineId") references "machine" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "placement_price" add constraint "FK_placement_price_price_card" foreign key ("priceCardId") references "machine_price_card" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "placement_price" add constraint "FK_placement_price_price_increase_card" foreign key ("priceIncreaseCardId") references "machine_price_card" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "placement_price" add constraint "CHK_placement_price_shape" check ("cpu" >= 0 and "memoryGib" >= 0 and "diskGib" >= 0 and "gpu" >= 0);`);
    this.addSql(`alter table "placement_price" add constraint "CHK_placement_price_reprice_attempts" check ("repriceAttempts" >= 0);`);
    this.addSql(`alter table "placement_price" add constraint "CHK_placement_price_increase" check (("priceIncreaseAt" is null) = ("priceIncreaseCardId" is null));`);
    this.addSql(`alter table "placement_price" add constraint "CHK_placement_price_end_reason" check ("endReason" is null or "endReason" in ('repriced', 'resized', 'moved', 'reassigned', 'archived', 'destroyed', 'released'));`);
    this.addSql(`alter table "placement_price" add constraint "CHK_placement_price_end" check (("endedAt" is null) = ("endReason" is null));`);
    this.addSql(`alter table "placement_price" add constraint "CHK_placement_price_markup" check ("markupBasisPoints" >= 0 and "markupBasisPoints" <= 10000);`);
    this.addSql(`alter table "placement_price" add constraint "CHK_placement_price_self_use" check (("priceCardId" is null) = ("customerOrganizationId" = "hostOrganizationId"));`);

    this.addSql(`alter table "sandbox_usage_periods_archive" add constraint "FK_sandbox_usage_periods_archive_customer_organization" foreign key ("customerOrganizationId") references "organization" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "sandbox_usage_periods_archive" add constraint "FK_sandbox_usage_periods_archive_host_organization" foreign key ("hostOrganizationId") references "organization" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "sandbox_usage_periods_archive" add constraint "FK_sandbox_usage_periods_archive_placement" foreign key ("placementId") references "sandbox_placement" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "sandbox_usage_periods_archive" add constraint "FK_sandbox_usage_periods_archive_machine" foreign key ("machineId") references "machine" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "sandbox_usage_periods_archive" add constraint "FK_sandbox_usage_periods_archive_price" foreign key ("placementPriceId") references "placement_price" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "sandbox_usage_periods_archive" add constraint "CHK_sandbox_usage_periods_archive_mode" check ("mode" in ('full', 'disk'));`);
    this.addSql(`alter table "sandbox_usage_periods_archive" add constraint "CHK_sandbox_usage_periods_archive_assignment_generation" check ("assignmentGeneration" > 0);`);

    this.addSql(`alter table "sandbox_usage_periods" add constraint "FK_sandbox_usage_periods_customer_organization" foreign key ("customerOrganizationId") references "organization" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "sandbox_usage_periods" add constraint "FK_sandbox_usage_periods_host_organization" foreign key ("hostOrganizationId") references "organization" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "sandbox_usage_periods" add constraint "FK_sandbox_usage_periods_placement" foreign key ("placementId") references "sandbox_placement" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "sandbox_usage_periods" add constraint "FK_sandbox_usage_periods_machine" foreign key ("machineId") references "machine" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "sandbox_usage_periods" add constraint "FK_sandbox_usage_periods_price" foreign key ("placementPriceId") references "placement_price" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "sandbox_usage_periods" add constraint "CHK_sandbox_usage_periods_compute_session" check (("runningSince" is not null) = ("mode" = 'full'));`);
    this.addSql(`alter table "sandbox_usage_periods" add constraint "CHK_sandbox_usage_periods_mode" check ("mode" in ('full', 'disk'));`);
    this.addSql(`alter table "sandbox_usage_periods" add constraint "CHK_sandbox_usage_periods_assignment_generation" check ("assignmentGeneration" > 0);`);

    this.addSql(`alter table "sandbox_billable_usage" add constraint "FK_sandbox_billable_usage_sandbox" foreign key ("sandboxId") references "sandbox" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "sandbox_billable_usage" add constraint "FK_sandbox_billable_usage_customer_organization" foreign key ("customerOrganizationId") references "organization" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "sandbox_billable_usage" add constraint "FK_sandbox_billable_usage_host_organization" foreign key ("hostOrganizationId") references "organization" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "sandbox_billable_usage" add constraint "FK_sandbox_billable_usage_placement" foreign key ("placementId") references "sandbox_placement" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "sandbox_billable_usage" add constraint "FK_sandbox_billable_usage_machine" foreign key ("machineId") references "machine" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "sandbox_billable_usage" add constraint "FK_sandbox_billable_usage_price" foreign key ("placementPriceId") references "placement_price" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "sandbox_billable_usage" add constraint "CHK_sandbox_billable_usage_evidence_status" check ("evidenceStatus" in ('pending', 'corroborated'));`);
    this.addSql(`alter table "sandbox_billable_usage" add constraint "CHK_sandbox_billable_usage_amounts" check ("durationMillis" > 0 and cpu >= 0 and "memoryGiB" >= 0 and "diskGiB" >= 0 and gpu >= 0 and "totalChargeMicroUsd" > 0 and "vcpuMillis" >= 0 and "memoryGibMillis" >= 0 and "gpuMillis" >= 0 and "runningDiskGibMillis" >= 0 and "stoppedDiskGibMillis" >= 0 and "hostChargeMicroUsd" + "markupChargeMicroUsd" = "totalChargeMicroUsd");`);
    this.addSql(`alter table "sandbox_billable_usage" add constraint "CHK_sandbox_billable_usage_generation" check ("assignmentGeneration" > 0 and "policyVersion" > 0);`);
    this.addSql(`alter table "sandbox_billable_usage" add constraint "CHK_sandbox_billable_usage_window" check ("endAt" >= "startAt");`);

    this.addSql(`alter table "placement_billing_authorization" add constraint "FK_placement_billing_authorization_customer_organization" foreign key ("customerOrganizationId") references "organization" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "placement_billing_authorization" add constraint "FK_placement_billing_authorization_host_organization" foreign key ("hostOrganizationId") references "organization" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "placement_billing_authorization" add constraint "FK_placement_billing_authorization_price" foreign key ("placementPriceId") references "placement_price" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "placement_billing_authorization" add constraint "CHK_placement_billing_authorization_amounts" check ("estimatedHourlyMicroUsd" >= 0);`);

    this.addSql(`alter table "payment_channel_charge" add constraint "FK_payment_channel_charge_channel" foreign key ("paymentChannelId") references "payment_channel" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "payment_channel_charge" add constraint "FK_payment_channel_charge_placement_price" foreign key ("placementPriceId") references "placement_price" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "payment_channel_charge" add constraint "CHK_payment_channel_charge_amount" check ("chargedMicroUsd" >= 0);`);

    this.addSql(`alter table "network_usage_period" add constraint "FK_network_usage_period_price" foreign key ("placementPriceId") references "placement_price" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "network_usage_period" add constraint "FK_network_usage_period_placement" foreign key ("placementId") references "sandbox_placement" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "network_usage_period" add constraint "FK_network_usage_period_machine" foreign key ("machineId") references "machine" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "network_usage_period" add constraint "FK_network_usage_period_customer" foreign key ("customerOrganizationId") references "organization" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "network_usage_period" add constraint "FK_network_usage_period_host" foreign key ("hostOrganizationId") references "organization" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "network_usage_period" add constraint "CHK_network_usage_period_evidence" check ("assignmentGeneration" > 0 and "supplement" >= 0 and "receiptCount" >= 0 and "edgeSampleCount" >= 0);`);
    this.addSql(`alter table "network_usage_period" add constraint "CHK_network_usage_period_window" check ("periodEnd" > "periodStart");`);
    this.addSql(`alter table "network_usage_period" add constraint "CHK_network_usage_period_amounts" check ("edgeEgressBytes" >= 0 and "edgeIngressBytes" >= 0 and "internetEgressBytes" >= 0 and "internetIngressBytes" >= 0 and "hostEgressBytes" >= 0 and "hostIngressBytes" >= 0 and "clampedInternetEgressBytes" >= 0);`);

    this.addSql(`alter table "machine_usage_receipt" add constraint "FK_machine_usage_receipt_machine" foreign key ("machineId") references "machine" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "machine_usage_receipt" add constraint "FK_machine_usage_receipt_session" foreign key ("sessionId") references "machine_session" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "machine_usage_receipt" add constraint "FK_machine_usage_receipt_placement" foreign key ("placementId") references "sandbox_placement" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "machine_usage_receipt" add constraint "FK_machine_usage_receipt_predecessor" foreign key ("predecessorId") references "machine_usage_receipt" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "machine_usage_receipt" add constraint "FK_machine_usage_receipt_network_period" foreign key ("networkPeriodId") references "network_usage_period" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "machine_usage_receipt" add constraint "CHK_machine_usage_receipt_interval" check ("sampledAt" >= "intervalStartAt");`);
    this.addSql(`alter table "machine_usage_receipt" add constraint "CHK_machine_usage_receipt_network" check ("internetEgressBytes" >= 0 and "internetIngressBytes" >= 0 and "hostEgressBytes" >= 0 and "hostIngressBytes" >= 0 and "tapEgressBytes" >= 0 and "tapIngressBytes" >= 0 and "acceptedInternetEgressDeltaBytes" >= 0 and "acceptedInternetIngressDeltaBytes" >= 0 and "clampedInternetEgressBytes" >= 0 and "clampedInternetIngressBytes" >= 0 and "hostEgressDeltaBytes" >= 0 and "hostIngressDeltaBytes" >= 0);`);
    this.addSql(`alter table "machine_usage_receipt" add constraint "CHK_machine_usage_receipt_counters" check ("sequence" > 0 and "runningMillis" >= 0 and "acceptedComputeDeltaMillis" >= 0 and "acceptedStorageDeltaMillis" >= 0);`);
    this.addSql(`alter table "machine_usage_receipt" add constraint "CHK_machine_usage_receipt_resources" check (cpu >= 0 and "memoryGiB" >= 0 and "diskGiB" >= 0 and gpu >= 0);`);
    this.addSql(`alter table "machine_usage_receipt" add constraint "CHK_machine_usage_receipt_generation" check ("assignmentGeneration" > 0);`);

    this.addSql(`alter table "exposure_network_usage" add constraint "FK_exposure_network_usage_checkpoint" foreign key ("edgeCheckpointId") references "edge_usage_checkpoint" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "exposure_network_usage" add constraint "FK_exposure_network_usage_backend" foreign key ("backendId") references "sandbox_exposure_backend" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "exposure_network_usage" add constraint "FK_exposure_network_usage_exposure" foreign key ("exposureId") references "sandbox_exposure" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "exposure_network_usage" add constraint "FK_exposure_network_usage_organization" foreign key ("organizationId") references "organization" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "exposure_network_usage" add constraint "FK_exposure_network_usage_placement" foreign key ("placementId") references "sandbox_placement" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "exposure_network_usage" add constraint "FK_exposure_network_usage_machine" foreign key ("machineId") references "machine" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "exposure_network_usage" add constraint "FK_exposure_network_usage_edge" foreign key ("edgeId") references "network_edge" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "exposure_network_usage" add constraint "FK_exposure_network_usage_period" foreign key ("periodId") references "network_usage_period" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "exposure_network_usage" add constraint "CHK_exposure_network_usage_counters" check ("edgeBytesIn" >= 0 and "edgeBytesOut" >= 0 and "edgePacketsIn" >= 0 and "edgePacketsOut" >= 0);`);
    this.addSql(`alter table "exposure_network_usage" add constraint "CHK_exposure_network_usage_window" check ("intervalEndedAt" > "intervalStartedAt");`);
    this.addSql(`alter table "exposure_network_usage" add constraint "CHK_exposure_network_usage_protocol" check ("protocol" IN ('http', 'tcp', 'udp'));`);
    this.addSql(`alter table "exposure_network_usage" add constraint "CHK_exposure_network_usage_assignment" check ("assignmentGeneration" > 0);`);

    this.addSql(`alter table "billing_line_item" add constraint "FK_billing_line_item_customer_organization" foreign key ("customerOrganizationId") references "organization" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "billing_line_item" add constraint "FK_billing_line_item_host_organization" foreign key ("hostOrganizationId") references "organization" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "billing_line_item" add constraint "FK_billing_line_item_price" foreign key ("placementPriceId") references "placement_price" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "billing_line_item" add constraint "CHK_billing_line_beneficiary_kind" check ("beneficiaryKind" in ('host_organization', 'platform'));`);
    this.addSql(`alter table "billing_line_item" add constraint "CHK_billing_line_split" check ("hostMicroUsd" >= 0 and "markupMicroUsd" >= 0 and "hostMicroUsd" + "markupMicroUsd" = "grossMicroUsd");`);
    this.addSql(`alter table "billing_line_item" add constraint "CHK_billing_line_gross" check ("grossMicroUsd" >= 0);`);
    this.addSql(`alter table "billing_line_item" add constraint "CHK_billing_line_window" check ("periodEnd" >= "periodStart");`);
    this.addSql(`alter table "billing_line_item" add constraint "CHK_billing_line_price" check ("placementPriceId" is not null and "quantities" is not null);`);

    this.addSql(`alter table "billing_line_quarantine" add constraint "FK_billing_line_quarantine_line" foreign key ("lineItemId") references "billing_line_item" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "billing_line_quarantine" add constraint "CHK_billing_line_quarantine_fault_domain" check ("faultDomain" in ('machine', 'platform'));`);
    this.addSql(`alter table "billing_line_quarantine" add constraint "CHK_billing_line_quarantine_failure" check ("failureCode" in ('evidence_missing', 'evidence_schema_unsupported', 'evidence_reference_mismatch', 'line_content_mismatch', 'price_mismatch', 'machine_evidence_invalid', 'edge_evidence_invalid', 'attestation_mismatch', 'charge_exceeds_attestation', 'machine_verification_failed', 'audit_exception'));`);

    this.addSql(`alter table "billing_line_adjustment" add constraint "billing_line_adjustment_lineItemId_fkey" foreign key ("lineItemId") references "billing_line_item" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "billing_line_adjustment" add constraint "CHK_billing_line_adjustment_kind" check (kind in ('credit', 'debit'));`);
    this.addSql(`alter table "billing_line_adjustment" add constraint "CHK_billing_line_adjustment_amount" check ("amountMicroUsd" > 0);`);

    this.addSql(`alter table "billing_evidence_bundle" add constraint "FK_billing_evidence_bundle_line" foreign key ("lineItemId") references "billing_line_item" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "billing_evidence_bundle" add constraint "CHK_billing_evidence_bundle_version" check ("schemaVersion" = 5);`);

    this.addSql(`alter table "machine_listing" add constraint "FK_machine_listing_machine" foreign key ("machineId") references "machine" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "machine_listing" add constraint "FK_machine_listing_current_price_card" foreign key ("currentPriceCardId") references "machine_price_card" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "machine_listing" add constraint "CHK_machine_listing_visibility" check ("visibility" in ('private', 'public'));`);
    this.addSql(`alter table "machine_listing" add constraint "CHK_machine_listing_traffic_cap" check ("monthlyTrafficCapGb" is null or "monthlyTrafficCapGb" > 0);`);
    this.addSql(`alter table "machine_listing" add constraint "CHK_machine_listing_state" check ("state" in ('draft', 'listed', 'paused'));`);
    this.addSql(`alter table "machine_listing" add constraint "CHK_machine_listing_priced" check ("state" <> 'listed' or "visibility" = 'private' or "currentPriceCardId" is not null);`);

    this.addSql(`alter table "invitation" add constraint "invitation_organizationId_fk" foreign key ("organizationId") references "organization" ("id") on delete cascade;`);
    this.addSql(`alter table "invitation" add constraint "invitation_inviterId_fk" foreign key ("inviterId") references "user" ("id") on delete cascade;`);

    this.addSql(`alter table "account" add constraint "account_user_id_fk" foreign key ("userId") references "user" ("id") on delete cascade;`);

    this.addSql(`alter table "abuse_case" add constraint "FK_abuse_case_machine" foreign key ("machineId") references "machine" ("id") on update no action on delete set null;`);
    this.addSql(`alter table "abuse_case" add constraint "FK_abuse_case_resolved_by" foreign key ("resolvedBy") references "user" ("id") on update no action on delete set null;`);
    this.addSql(`alter table "abuse_case" add constraint "CHK_abuse_case_status" check ("status" in ('observed', 'throttled', 'suspended', 'resolved'));`);

    this.addSql(`alter table "abuse_report" add constraint "FK_abuse_report_reporter_user" foreign key ("reporterUserId") references "user" ("id") on update no action on delete set null;`);
    this.addSql(`alter table "abuse_report" add constraint "FK_abuse_report_case" foreign key ("abuseCaseId") references "abuse_case" ("id") on update no action on delete set null;`);
    this.addSql(`alter table "abuse_report" add constraint "FK_abuse_report_decided_by" foreign key ("decidedBy") references "user" ("id") on update no action on delete set null;`);
    this.addSql(`alter table "abuse_report" add constraint "CHK_abuse_report_status" check ("status" in ('received', 'acknowledged', 'matched', 'unmatched', 'in_review', 'actioned', 'no_action', 'referred', 'appealed', 'closed'));`);
    this.addSql(`alter table "abuse_report" add constraint "CHK_abuse_report_isp_outcome" check ("ispOutcome" is null or "ispOutcome" in ('not_snapflow', 'attributed', 'manual_review', 'records_incomplete'));`);
    this.addSql(`alter table "abuse_report" add constraint "CHK_abuse_report_category" check ("category" in ('phishing', 'malware', 'csam', 'non_consensual_imagery', 'copyright', 'trademark', 'network_abuse', 'threat_to_life', 'other'));`);
    this.addSql(`alter table "abuse_report" add constraint "CHK_abuse_report_reporter_type" check ("reporterType" in ('public', 'host', 'user'));`);

    this.addSql(`alter table "abuse_evidence" add constraint "FK_abuse_evidence_case" foreign key ("abuseCaseId") references "abuse_case" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "abuse_evidence" add constraint "CHK_abuse_evidence_kind" check ("kind" in ('sandbox_snapshot', 'connection_records', 'preview_capture'));`);

    this.addSql(`alter table "abuse_case_action" add constraint "FK_abuse_case_action_case" foreign key ("abuseCaseId") references "abuse_case" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "abuse_case_action" add constraint "FK_abuse_case_action_actor" foreign key ("actorId") references "user" ("id") on update no action on delete set null;`);
    this.addSql(`alter table "abuse_case_action" add constraint "CHK_abuse_case_action_action" check ("action" in ('disable_preview', 'block_egress', 'pause_sandbox', 'terminate_sandbox', 'suspend_organization', 'refer'));`);

    this.addSql(`alter table "user_wallet" add constraint "FK_user_wallet_user" foreign key ("userId") references "user" ("id") on update no action on delete set null;`);
    this.addSql(`alter table "user_wallet" add constraint "FK_user_wallet_passkey" foreign key ("passkeyId") references "passkey" ("id") on update no action on delete set null;`);
    this.addSql(`alter table "user_wallet" add constraint "CHK_user_wallet_recovery_owner_kind" check ("recoveryOwnerKind" is null or "recoveryOwnerKind" in ('phrase', 'passkey', 'wallet'));`);
    this.addSql(`alter table "user_wallet" add constraint "CHK_user_wallet_recovery_status" check ("recoveryStatus" in ('none', 'pending', 'active'));`);

    this.addSql(`alter table "verification_review" add constraint "FK_verification_review_machine" foreign key ("machineId") references "machine" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "verification_review" add constraint "CHK_verification_review_resolution" check (("state" = 'open') = ("resolvedAt" is null));`);
    this.addSql(`alter table "verification_review" add constraint "CHK_verification_review_state" check ("state" in ('open', 'cleared', 'forfeited', 'delisted'));`);
    this.addSql(`alter table "verification_review" add constraint "CHK_verification_review_kind" check ("kind" in ('spot_check_failed', 'fingerprint_conflict', 'benchmark_regression', 'network_meter_inflated', 'network_meter_mismatch'));`);

    this.addSql(`alter table "volume" add constraint "FK_volume_organization" foreign key ("organizationId") references "organization" ("id") on update no action on delete restrict;`);

    this.addSql(`alter table "volume_backup" add constraint "FK_volume_backup_volume" foreign key ("volumeId") references "volume" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "volume_backup" add constraint "FK_volume_backup_organization" foreign key ("organizationId") references "organization" ("id") on update no action on delete restrict;`);
    this.addSql(`alter table "volume_backup" add constraint "CHK_volume_backup_data_key_envelope_version" check ("dataKeyEnvelopeVersion" = 1);`);

    this.addSql(`alter table "wallet_transaction" add constraint "FK_wallet_transaction_user_wallet" foreign key ("userWalletId") references "user_wallet" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "wallet_transaction" add constraint "CHK_wallet_transaction_recovery_owner_kind" check ("recoveryOwnerKind" is null or "recoveryOwnerKind" in ('phrase', 'passkey', 'wallet'));`);
    this.addSql(`alter table "wallet_transaction" add constraint "CHK_wallet_transaction_status" check ("status" in ('queued', 'sent', 'succeeded', 'failed'));`);

    this.addSql(`alter table "settlement_transaction" add constraint "FK_settlement_transaction_wallet_transaction" foreign key ("walletTransactionId") references "wallet_transaction" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "settlement_transaction" add constraint "FK_settlement_transaction_host_settlement" foreign key ("hostSettlementId") references "host_settlement" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "settlement_transaction" add constraint "CHK_settlement_transaction_status" check ("status" in ('pending', 'succeeded', 'reverted', 'dropped'));`);
    this.addSql(`alter table "settlement_transaction" add constraint "CHK_settlement_transaction_kind" check ("kind" in ('host_settlement', 'claim_batch', 'withdraw_host', 'sweep_fees', 'wallet_transaction', 'auto_top_up', 'pause_escrow'));`);

    this.addSql(`alter table "claim_attempt" add constraint "FK_claim_attempt_transaction" foreign key ("transactionId") references "settlement_transaction" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "claim_attempt" add constraint "FK_claim_attempt_channel" foreign key ("paymentChannelId") references "payment_channel" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "claim_attempt" add constraint "FK_claim_attempt_voucher" foreign key ("voucherId") references "payment_voucher" ("id") on update no action on delete cascade;`);

    this.addSql(`alter table "webhook_endpoint" add constraint "FK_webhook_endpoint_organization" foreign key ("organizationId") references "organization" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "webhook_endpoint" add constraint "CHK_webhook_endpoint_secret_version" check ("secretVersion" > 0);`);
    this.addSql(`alter table "webhook_endpoint" add constraint "CHK_webhook_endpoint_enabled_state" check (("enabled" and "disabledReason" is null and "disabledAt" is null) or (not "enabled" and "disabledReason" is not null and "disabledAt" is not null));`);
    this.addSql(`alter table "webhook_endpoint" add constraint "CHK_webhook_endpoint_disabled_reason" check ("disabledReason" is null or "disabledReason" in ('manual', 'failing'));`);

    this.addSql(`alter table "webhook_message" add constraint "FK_webhook_message_organization" foreign key ("organizationId") references "organization" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "webhook_message" add constraint "CHK_webhook_message_event_type" check ("eventType" in ('sandbox.created', 'sandbox.started', 'sandbox.stopped', 'sandbox.archived', 'sandbox.deleted', 'sandbox.error', 'sandbox.machine_unavailable', 'sandbox.paused', 'sandbox.paused_for_payment', 'sandbox.preempted', 'sandbox.state_updated', 'snapshot.ready', 'snapshot.failed', 'snapshot.deleted', 'volume.created', 'volume.ready', 'volume.deleted', 'volume.error', 'billing.low_balance', 'billing.sandboxes_stopped_for_funds', 'billing.auto_top_up_failed', 'billing.archive_deletion_scheduled', 'billing.signer_expiring', 'billing.signer_expired', 'billing.signer_revoked', 'usage.api_key_budget_exhausted', 'webhook.test'));`);

    this.addSql(`alter table "webhook_delivery" add constraint "FK_webhook_delivery_endpoint" foreign key ("endpointId", "organizationId") references "webhook_endpoint" ("id", "organizationId") on update no action on delete cascade;`);
    this.addSql(`alter table "webhook_delivery" add constraint "FK_webhook_delivery_message" foreign key ("messageId", "organizationId") references "webhook_message" ("id", "organizationId") on update no action on delete cascade;`);
    this.addSql(`alter table "webhook_delivery" add constraint "CHK_webhook_delivery_attempts" check ("attempts" >= 0);`);
    this.addSql(`alter table "webhook_delivery" add constraint "CHK_webhook_delivery_next_trigger" check ("nextTrigger" in ('scheduled', 'manual'));`);
    this.addSql(`alter table "webhook_delivery" add constraint "CHK_webhook_delivery_status" check ("status" in ('pending', 'succeeded', 'failed'));`);

    this.addSql(`alter table "webhook_delivery_attempt" add constraint "FK_webhook_delivery_attempt_delivery" foreign key ("deliveryId") references "webhook_delivery" ("id") on update no action on delete cascade;`);
    this.addSql(`alter table "webhook_delivery_attempt" add constraint "CHK_webhook_delivery_attempt_duration" check ("durationMilliseconds" >= 0);`);
    this.addSql(`alter table "webhook_delivery_attempt" add constraint "CHK_webhook_delivery_attempt_trigger" check ("trigger" in ('scheduled', 'manual'));`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "billing_ledger_entry" drop constraint "FK_billing_ledger_entry_account";`);
    this.addSql(`alter table "billing_ledger_entry" drop constraint "FK_billing_ledger_entry_transaction";`);
    this.addSql(`alter table "snapshot" drop constraint "snapshot_buildInfoSnapshotRef_fk";`);
    this.addSql(`alter table "sandbox" drop constraint "sandbox_buildInfoSnapshotRef_fk";`);
    this.addSql(`alter table "network_edge_session" drop constraint "FK_network_edge_session_edge";`);
    this.addSql(`alter table "edge_usage_checkpoint" drop constraint "FK_edge_usage_checkpoint_edge";`);
    this.addSql(`alter table "machine_edge_binding" drop constraint "FK_machine_edge_binding_edge";`);
    this.addSql(`alter table "sandbox_exposure_backend" drop constraint "FK_exposure_backend_edge";`);
    this.addSql(`alter table "exposure_network_usage" drop constraint "FK_exposure_network_usage_edge";`);
    this.addSql(`alter table "exposure_network_usage" drop constraint "FK_exposure_network_usage_checkpoint";`);
    this.addSql(`alter table "machine_qualification_challenge" drop constraint "FK_machine_qualification_challenge_job";`);
    this.addSql(`alter table "machine_reliability_event" drop constraint "FK_machine_reliability_event_job";`);
    this.addSql(`alter table "twoFactor" drop constraint "two_factor_user_id_fk";`);
    this.addSql(`alter table "session" drop constraint "session_user_id_fk";`);
    this.addSql(`alter table "passkey" drop constraint "passkey_user_id_fk";`);
    this.addSql(`alter table "organization" drop constraint "organization_createdBy_fk";`);
    this.addSql(`alter table "payment_channel_refund" drop constraint "FK_payment_channel_refund_user";`);
    this.addSql(`alter table "organization_quota_increase_request" drop constraint "FK_quota_increase_request_requested_by";`);
    this.addSql(`alter table "organization_quota_increase_request" drop constraint "FK_quota_increase_request_reviewed_by";`);
    this.addSql(`alter table "member" drop constraint "member_userId_fk";`);
    this.addSql(`alter table "machine_price_card" drop constraint "FK_machine_price_card_created_by";`);
    this.addSql(`alter table "invitation" drop constraint "invitation_inviterId_fk";`);
    this.addSql(`alter table "account" drop constraint "account_user_id_fk";`);
    this.addSql(`alter table "abuse_case" drop constraint "FK_abuse_case_resolved_by";`);
    this.addSql(`alter table "abuse_report" drop constraint "FK_abuse_report_reporter_user";`);
    this.addSql(`alter table "abuse_report" drop constraint "FK_abuse_report_decided_by";`);
    this.addSql(`alter table "abuse_case_action" drop constraint "FK_abuse_case_action_actor";`);
    this.addSql(`alter table "user_wallet" drop constraint "FK_user_wallet_user";`);
    this.addSql(`alter table "user_wallet" drop constraint "FK_user_wallet_passkey";`);
    this.addSql(`alter table "storage_charge" drop constraint "FK_storage_charge_organization";`);
    this.addSql(`alter table "snapshot" drop constraint "FK_snapshot_organization";`);
    this.addSql(`alter table "settings" drop constraint "settings_spotCheckOrganizationId_fk";`);
    this.addSql(`alter table "secret" drop constraint "FK_secret_organization";`);
    this.addSql(`alter table "payment_wallet" drop constraint "FK_payment_wallet_organization";`);
    this.addSql(`alter table "payment_channel" drop constraint "FK_payment_channel_customer_organization";`);
    this.addSql(`alter table "payment_channel" drop constraint "FK_payment_channel_host_organization";`);
    this.addSql(`alter table "organizationRole" drop constraint "organizationRole_organizationId_fk";`);
    this.addSql(`alter table "organization_quota_increase_request" drop constraint "FK_quota_increase_request_organization";`);
    this.addSql(`alter table "organization_quota" drop constraint "organization_quota_organizationId_fk";`);
    this.addSql(`alter table "organization_limits" drop constraint "organization_limits_organizationId_fk";`);
    this.addSql(`alter table "organization_funding" drop constraint "FK_organization_funding_organization";`);
    this.addSql(`alter table "machine" drop constraint "FK_machine_organization";`);
    this.addSql(`alter table "host_profile" drop constraint "FK_host_profile_organization";`);
    this.addSql(`alter table "escrow_event" drop constraint "FK_escrow_event_customer_organization";`);
    this.addSql(`alter table "escrow_event" drop constraint "FK_escrow_event_host_organization";`);
    this.addSql(`alter table "docker_registry" drop constraint "docker_registry_organizationId_fk";`);
    this.addSql(`alter table "delegated_signer" drop constraint "FK_delegated_signer_organization";`);
    this.addSql(`alter table "billing_receipt" drop constraint "FK_billing_receipt_organization";`);
    this.addSql(`alter table "billing_profile" drop constraint "FK_billing_profile_organization";`);
    this.addSql(`alter table "billing_budget_version" drop constraint "FK_billing_budget_version_organization";`);
    this.addSql(`alter table "billing_budget" drop constraint "billing_budget_organizationId_fkey";`);
    this.addSql(`alter table "auto_top_up" drop constraint "FK_auto_top_up_organization";`);
    this.addSql(`alter table "apikey" drop constraint "apikey_reference_id_fk";`);
    this.addSql(`alter table "sandbox" drop constraint "FK_sandbox_organization";`);
    this.addSql(`alter table "sandbox_secret_binding_set" drop constraint "FK_sandbox_secret_binding_set_organization";`);
    this.addSql(`alter table "early_session_failure" drop constraint "FK_early_session_failure_customer";`);
    this.addSql(`alter table "machine_reliability_event" drop constraint "FK_machine_reliability_event_customer_organization";`);
    this.addSql(`alter table "sandbox_exposure" drop constraint "FK_sandbox_exposure_organization";`);
    this.addSql(`alter table "sandbox_custom_domain" drop constraint "FK_custom_domain_organization";`);
    this.addSql(`alter table "api_key_budget" drop constraint "FK_api_key_budget_organization";`);
    this.addSql(`alter table "member" drop constraint "member_organizationId_fk";`);
    this.addSql(`alter table "machine_price_card" drop constraint "FK_machine_price_card_organization";`);
    this.addSql(`alter table "placement_price" drop constraint "FK_placement_price_customer_organization";`);
    this.addSql(`alter table "placement_price" drop constraint "FK_placement_price_host_organization";`);
    this.addSql(`alter table "sandbox_usage_periods_archive" drop constraint "FK_sandbox_usage_periods_archive_customer_organization";`);
    this.addSql(`alter table "sandbox_usage_periods_archive" drop constraint "FK_sandbox_usage_periods_archive_host_organization";`);
    this.addSql(`alter table "sandbox_usage_periods" drop constraint "FK_sandbox_usage_periods_customer_organization";`);
    this.addSql(`alter table "sandbox_usage_periods" drop constraint "FK_sandbox_usage_periods_host_organization";`);
    this.addSql(`alter table "sandbox_billable_usage" drop constraint "FK_sandbox_billable_usage_customer_organization";`);
    this.addSql(`alter table "sandbox_billable_usage" drop constraint "FK_sandbox_billable_usage_host_organization";`);
    this.addSql(`alter table "placement_billing_authorization" drop constraint "FK_placement_billing_authorization_customer_organization";`);
    this.addSql(`alter table "placement_billing_authorization" drop constraint "FK_placement_billing_authorization_host_organization";`);
    this.addSql(`alter table "network_usage_period" drop constraint "FK_network_usage_period_customer";`);
    this.addSql(`alter table "network_usage_period" drop constraint "FK_network_usage_period_host";`);
    this.addSql(`alter table "exposure_network_usage" drop constraint "FK_exposure_network_usage_organization";`);
    this.addSql(`alter table "billing_line_item" drop constraint "FK_billing_line_item_customer_organization";`);
    this.addSql(`alter table "billing_line_item" drop constraint "FK_billing_line_item_host_organization";`);
    this.addSql(`alter table "invitation" drop constraint "invitation_organizationId_fk";`);
    this.addSql(`alter table "volume" drop constraint "FK_volume_organization";`);
    this.addSql(`alter table "volume_backup" drop constraint "FK_volume_backup_organization";`);
    this.addSql(`alter table "webhook_endpoint" drop constraint "FK_webhook_endpoint_organization";`);
    this.addSql(`alter table "webhook_message" drop constraint "FK_webhook_message_organization";`);
    this.addSql(`alter table "secret_version" drop constraint "FK_secret_version_secret";`);
    this.addSql(`alter table "sandbox_secret_binding" drop constraint "FK_sandbox_secret_binding_secret";`);
    this.addSql(`alter table "sandbox_secret_binding" drop constraint "FK_sandbox_secret_binding_version";`);
    this.addSql(`alter table "payment_voucher" drop constraint "FK_payment_voucher_channel";`);
    this.addSql(`alter table "payment_channel_refund" drop constraint "FK_payment_channel_refund_channel";`);
    this.addSql(`alter table "payment_channel_charge" drop constraint "FK_payment_channel_charge_channel";`);
    this.addSql(`alter table "claim_attempt" drop constraint "FK_claim_attempt_channel";`);
    this.addSql(`alter table "signature_audit" drop constraint "FK_signature_audit_voucher";`);
    this.addSql(`alter table "claim_attempt" drop constraint "FK_claim_attempt_voucher";`);
    this.addSql(`alter table "machine_session" drop constraint "FK_machine_session_machine";`);
    this.addSql(`alter table "machine_qualification_challenge" drop constraint "FK_machine_qualification_challenge_machine";`);
    this.addSql(`alter table "machine_public_address" drop constraint "FK_machine_public_address_machine";`);
    this.addSql(`alter table "machine_observation" drop constraint "FK_machine_observation_machine";`);
    this.addSql(`alter table "machine_host_key" drop constraint "FK_machine_host_key_machine";`);
    this.addSql(`alter table "machine_health_gap" drop constraint "FK_machine_health_gap_machine";`);
    this.addSql(`alter table "machine_fingerprint_component" drop constraint "FK_machine_fingerprint_component_machine";`);
    this.addSql(`alter table "machine_edge_binding" drop constraint "FK_machine_edge_binding_machine";`);
    this.addSql(`alter table "machine_connection_coverage" drop constraint "FK_machine_connection_coverage_machine";`);
    this.addSql(`alter table "machine_benchmark" drop constraint "FK_machine_benchmark_machine";`);
    this.addSql(`alter table "machine_assessment" drop constraint "FK_machine_assessment_machine";`);
    this.addSql(`alter table "host_settlement" drop constraint "FK_host_settlement_machine";`);
    this.addSql(`alter table "sandbox" drop constraint "FK_sandbox_pinned_machine";`);
    this.addSql(`alter table "sandbox_placement" drop constraint "FK_sandbox_placement_machine";`);
    this.addSql(`alter table "secret_delivery_event" drop constraint "FK_secret_delivery_event_machine";`);
    this.addSql(`alter table "early_session_failure" drop constraint "FK_early_session_failure_machine";`);
    this.addSql(`alter table "sandbox_observed_status" drop constraint "FK_sandbox_observed_status_machine";`);
    this.addSql(`alter table "machine_spot_check" drop constraint "FK_machine_spot_check_machine";`);
    this.addSql(`alter table "machine_reliability_event" drop constraint "FK_machine_reliability_event_machine";`);
    this.addSql(`alter table "machine_price_card" drop constraint "FK_machine_price_card_machine";`);
    this.addSql(`alter table "placement_price" drop constraint "FK_placement_price_machine";`);
    this.addSql(`alter table "sandbox_usage_periods_archive" drop constraint "FK_sandbox_usage_periods_archive_machine";`);
    this.addSql(`alter table "sandbox_usage_periods" drop constraint "FK_sandbox_usage_periods_machine";`);
    this.addSql(`alter table "sandbox_billable_usage" drop constraint "FK_sandbox_billable_usage_machine";`);
    this.addSql(`alter table "network_usage_period" drop constraint "FK_network_usage_period_machine";`);
    this.addSql(`alter table "machine_usage_receipt" drop constraint "FK_machine_usage_receipt_machine";`);
    this.addSql(`alter table "exposure_network_usage" drop constraint "FK_exposure_network_usage_machine";`);
    this.addSql(`alter table "machine_listing" drop constraint "FK_machine_listing_machine";`);
    this.addSql(`alter table "abuse_case" drop constraint "FK_abuse_case_machine";`);
    this.addSql(`alter table "verification_review" drop constraint "FK_verification_review_machine";`);
    this.addSql(`alter table "machine_qualification_challenge" drop constraint "FK_machine_qualification_challenge_session";`);
    this.addSql(`alter table "machine_observation" drop constraint "FK_machine_observation_session";`);
    this.addSql(`alter table "secret_delivery_event" drop constraint "FK_secret_delivery_event_session";`);
    this.addSql(`alter table "machine_reliability_event" drop constraint "FK_machine_reliability_event_session";`);
    this.addSql(`alter table "machine_usage_receipt" drop constraint "FK_machine_usage_receipt_session";`);
    this.addSql(`alter table "machine_qualification_evidence" drop constraint "FK_machine_qualification_evidence_challenge";`);
    this.addSql(`alter table "sandbox_exposure_backend" drop constraint "FK_exposure_backend_binding";`);
    this.addSql(`alter table "machine" drop constraint "FK_machine_latest_benchmark";`);
    this.addSql(`alter table "settlement_transaction" drop constraint "FK_settlement_transaction_host_settlement";`);
    this.addSql(`alter table "signature_audit" drop constraint "FK_signature_audit_delegated_signer";`);
    this.addSql(`alter table "sandbox" drop constraint "FK_sandbox_api_key";`);
    this.addSql(`alter table "api_key_budget" drop constraint "FK_api_key_budget_api_key";`);
    this.addSql(`alter table "ssh_access" drop constraint "ssh_access_sandboxId_fk";`);
    this.addSql(`alter table "sandbox_secret_binding_set" drop constraint "FK_sandbox_secret_binding_set_sandbox";`);
    this.addSql(`alter table "sandbox_secret_binding" drop constraint "FK_sandbox_secret_binding_sandbox";`);
    this.addSql(`alter table "sandbox_placement" drop constraint "FK_sandbox_placement_sandbox";`);
    this.addSql(`alter table "secret_delivery_event" drop constraint "FK_secret_delivery_event_sandbox";`);
    this.addSql(`alter table "sandbox_observed_status" drop constraint "FK_sandbox_observed_status_sandbox";`);
    this.addSql(`alter table "sandbox_last_activity" drop constraint "sandbox_last_activity_sandboxId_fk";`);
    this.addSql(`alter table "sandbox_fork" drop constraint "sandbox_fork_parentId_fk";`);
    this.addSql(`alter table "sandbox_fork" drop constraint "sandbox_fork_childId_fk";`);
    this.addSql(`alter table "machine_spot_check" drop constraint "FK_machine_spot_check_sandbox";`);
    this.addSql(`alter table "machine_reliability_event" drop constraint "FK_machine_reliability_event_sandbox";`);
    this.addSql(`alter table "sandbox_exposure" drop constraint "FK_sandbox_exposure_sandbox";`);
    this.addSql(`alter table "sandbox_custom_domain" drop constraint "FK_custom_domain_sandbox";`);
    this.addSql(`alter table "placement_price" drop constraint "FK_placement_price_sandbox";`);
    this.addSql(`alter table "sandbox_billable_usage" drop constraint "FK_sandbox_billable_usage_sandbox";`);
    this.addSql(`alter table "secret_delivery_event" drop constraint "FK_secret_delivery_event_placement";`);
    this.addSql(`alter table "early_session_failure" drop constraint "FK_early_session_failure_placement";`);
    this.addSql(`alter table "machine_reliability_event" drop constraint "FK_machine_reliability_event_placement";`);
    this.addSql(`alter table "sandbox_exposure_backend" drop constraint "FK_exposure_backend_placement_fence";`);
    this.addSql(`alter table "placement_price" drop constraint "FK_placement_price_placement";`);
    this.addSql(`alter table "sandbox_usage_periods_archive" drop constraint "FK_sandbox_usage_periods_archive_placement";`);
    this.addSql(`alter table "sandbox_usage_periods" drop constraint "FK_sandbox_usage_periods_placement";`);
    this.addSql(`alter table "sandbox_billable_usage" drop constraint "FK_sandbox_billable_usage_placement";`);
    this.addSql(`alter table "network_usage_period" drop constraint "FK_network_usage_period_placement";`);
    this.addSql(`alter table "machine_usage_receipt" drop constraint "FK_machine_usage_receipt_placement";`);
    this.addSql(`alter table "exposure_network_usage" drop constraint "FK_exposure_network_usage_placement";`);
    this.addSql(`alter table "sandbox_exposure_reconciliation" drop constraint "FK_exposure_reconciliation_exposure";`);
    this.addSql(`alter table "sandbox_exposure_backend" drop constraint "FK_exposure_backend_exposure";`);
    this.addSql(`alter table "sandbox_custom_domain" drop constraint "FK_custom_domain_exposure";`);
    this.addSql(`alter table "exposure_network_usage" drop constraint "FK_exposure_network_usage_exposure";`);
    this.addSql(`alter table "exposure_network_usage" drop constraint "FK_exposure_network_usage_backend";`);
    this.addSql(`alter table "placement_price" drop constraint "FK_placement_price_price_card";`);
    this.addSql(`alter table "placement_price" drop constraint "FK_placement_price_price_increase_card";`);
    this.addSql(`alter table "machine_listing" drop constraint "FK_machine_listing_current_price_card";`);
    this.addSql(`alter table "sandbox_usage_periods_archive" drop constraint "FK_sandbox_usage_periods_archive_price";`);
    this.addSql(`alter table "sandbox_usage_periods" drop constraint "FK_sandbox_usage_periods_price";`);
    this.addSql(`alter table "sandbox_billable_usage" drop constraint "FK_sandbox_billable_usage_price";`);
    this.addSql(`alter table "placement_billing_authorization" drop constraint "FK_placement_billing_authorization_price";`);
    this.addSql(`alter table "payment_channel_charge" drop constraint "FK_payment_channel_charge_placement_price";`);
    this.addSql(`alter table "network_usage_period" drop constraint "FK_network_usage_period_price";`);
    this.addSql(`alter table "billing_line_item" drop constraint "FK_billing_line_item_price";`);
    this.addSql(`alter table "machine_usage_receipt" drop constraint "FK_machine_usage_receipt_network_period";`);
    this.addSql(`alter table "exposure_network_usage" drop constraint "FK_exposure_network_usage_period";`);
    this.addSql(`alter table "machine_usage_receipt" drop constraint "FK_machine_usage_receipt_predecessor";`);
    this.addSql(`alter table "billing_line_quarantine" drop constraint "FK_billing_line_quarantine_line";`);
    this.addSql(`alter table "billing_line_adjustment" drop constraint "billing_line_adjustment_lineItemId_fkey";`);
    this.addSql(`alter table "billing_evidence_bundle" drop constraint "FK_billing_evidence_bundle_line";`);
    this.addSql(`alter table "abuse_report" drop constraint "FK_abuse_report_case";`);
    this.addSql(`alter table "abuse_evidence" drop constraint "FK_abuse_evidence_case";`);
    this.addSql(`alter table "abuse_case_action" drop constraint "FK_abuse_case_action_case";`);
    this.addSql(`alter table "wallet_transaction" drop constraint "FK_wallet_transaction_user_wallet";`);
    this.addSql(`alter table "volume_backup" drop constraint "FK_volume_backup_volume";`);
    this.addSql(`alter table "settlement_transaction" drop constraint "FK_settlement_transaction_wallet_transaction";`);
    this.addSql(`alter table "claim_attempt" drop constraint "FK_claim_attempt_transaction";`);
    this.addSql(`alter table "webhook_delivery" drop constraint "FK_webhook_delivery_endpoint";`);
    this.addSql(`alter table "webhook_delivery" drop constraint "FK_webhook_delivery_message";`);
    this.addSql(`alter table "webhook_delivery_attempt" drop constraint "FK_webhook_delivery_attempt_delivery";`);

    this.addSql(`drop table if exists "abuse_hostname" cascade;`);
    this.addSql(`drop table if exists "api_idempotency_record" cascade;`);
    this.addSql(`drop trigger if exists "audit_log_immutable" on "audit_log";`);
    this.addSql(`drop function if exists "audit_log_audit_log_immutable_fn"();`);
    this.addSql(`drop table if exists "audit_log" cascade;`);
    this.addSql(`drop trigger if exists "billing_ledger_immutable" on "billing_ledger_account";`);
    this.addSql(`drop function if exists "billing_ledger_account_billing_ledger_immutable_fn"();`);
    this.addSql(`drop table if exists "billing_ledger_account" cascade;`);
    this.addSql(`drop trigger if exists "billing_ledger_transaction_balanced" on "billing_ledger_transaction";`);
    this.addSql(`drop function if exists "billing_ledger_transaction_billing_ledger_transaction_balanced_fn"();`);
    this.addSql(`drop trigger if exists "billing_ledger_immutable" on "billing_ledger_transaction";`);
    this.addSql(`drop function if exists "billing_ledger_transaction_billing_ledger_immutable_fn"();`);
    this.addSql(`drop table if exists "billing_ledger_transaction" cascade;`);
    this.addSql(`drop trigger if exists "billing_ledger_entry_balanced" on "billing_ledger_entry";`);
    this.addSql(`drop function if exists "billing_ledger_entry_billing_ledger_entry_balanced_fn"();`);
    this.addSql(`drop trigger if exists "billing_ledger_immutable" on "billing_ledger_entry";`);
    this.addSql(`drop function if exists "billing_ledger_entry_billing_ledger_immutable_fn"();`);
    this.addSql(`drop table if exists "billing_ledger_entry" cascade;`);
    this.addSql(`drop table if exists "build_info" cascade;`);
    this.addSql(`drop table if exists "network_edge" cascade;`);
    this.addSql(`drop table if exists "network_edge_session" cascade;`);
    this.addSql(`drop table if exists "edge_usage_checkpoint" cascade;`);
    this.addSql(`drop table if exists "escrow_account" cascade;`);
    this.addSql(`drop table if exists "escrow_auto_top_up" cascade;`);
    this.addSql(`drop table if exists "escrow_claims_freeze" cascade;`);
    this.addSql(`drop table if exists "escrow_signer" cascade;`);
    this.addSql(`drop table if exists "job" cascade;`);
    this.addSql(`drop table if exists "machine_snapshot_target" cascade;`);
    this.addSql(`drop table if exists "machine_workload_outcome" cascade;`);
    this.addSql(`drop table if exists "realtime_outbox_deduplication" cascade;`);
    this.addSql(`drop table if exists "realtime_outbox_event" cascade;`);
    this.addSql(`drop table if exists "sanctioned_address" cascade;`);
    this.addSql(`drop table if exists "sanctions_list_sync" cascade;`);
    this.addSql(`drop table if exists "sanctions_pending_alert" cascade;`);
    this.addSql(`drop table if exists "sandbox_connection_record" cascade;`);
    this.addSql(`drop table if exists "settlement_chain_cursor" cascade;`);
    this.addSql(`drop table if exists "snapshot_machine" cascade;`);
    this.addSql(`drop table if exists "unmet_demand" cascade;`);
    this.addSql(`drop table if exists "user" cascade;`);
    this.addSql(`drop table if exists "twoFactor" cascade;`);
    this.addSql(`drop table if exists "session" cascade;`);
    this.addSql(`drop table if exists "passkey" cascade;`);
    this.addSql(`drop table if exists "organization" cascade;`);
    this.addSql(`drop table if exists "storage_charge" cascade;`);
    this.addSql(`drop table if exists "snapshot" cascade;`);
    this.addSql(`drop table if exists "settings" cascade;`);
    this.addSql(`drop table if exists "secret" cascade;`);
    this.addSql(`drop table if exists "secret_version" cascade;`);
    this.addSql(`drop table if exists "payment_wallet" cascade;`);
    this.addSql(`drop table if exists "payment_channel" cascade;`);
    this.addSql(`drop table if exists "payment_voucher" cascade;`);
    this.addSql(`drop table if exists "payment_channel_refund" cascade;`);
    this.addSql(`drop table if exists "organizationRole" cascade;`);
    this.addSql(`drop table if exists "organization_quota_increase_request" cascade;`);
    this.addSql(`drop table if exists "organization_quota" cascade;`);
    this.addSql(`drop table if exists "organization_limits" cascade;`);
    this.addSql(`drop table if exists "organization_funding" cascade;`);
    this.addSql(`drop table if exists "machine" cascade;`);
    this.addSql(`drop table if exists "machine_session" cascade;`);
    this.addSql(`drop table if exists "machine_qualification_challenge" cascade;`);
    this.addSql(`drop table if exists "machine_qualification_evidence" cascade;`);
    this.addSql(`drop table if exists "machine_public_address" cascade;`);
    this.addSql(`drop table if exists "machine_observation" cascade;`);
    this.addSql(`drop table if exists "machine_host_key" cascade;`);
    this.addSql(`drop table if exists "machine_health_gap" cascade;`);
    this.addSql(`drop table if exists "machine_fingerprint_component" cascade;`);
    this.addSql(`drop table if exists "machine_edge_binding" cascade;`);
    this.addSql(`drop table if exists "machine_connection_coverage" cascade;`);
    this.addSql(`drop table if exists "machine_benchmark" cascade;`);
    this.addSql(`drop table if exists "machine_assessment" cascade;`);
    this.addSql(`drop table if exists "host_settlement" cascade;`);
    this.addSql(`drop table if exists "host_profile" cascade;`);
    this.addSql(`drop table if exists "escrow_event" cascade;`);
    this.addSql(`drop table if exists "docker_registry" cascade;`);
    this.addSql(`drop table if exists "delegated_signer" cascade;`);
    this.addSql(`drop table if exists "signature_audit" cascade;`);
    this.addSql(`drop table if exists "billing_receipt" cascade;`);
    this.addSql(`drop table if exists "billing_profile" cascade;`);
    this.addSql(`drop table if exists "billing_budget_version" cascade;`);
    this.addSql(`drop table if exists "billing_budget" cascade;`);
    this.addSql(`drop table if exists "auto_top_up" cascade;`);
    this.addSql(`drop table if exists "apikey" cascade;`);
    this.addSql(`drop table if exists "sandbox" cascade;`);
    this.addSql(`drop table if exists "ssh_access" cascade;`);
    this.addSql(`drop table if exists "sandbox_secret_binding_set" cascade;`);
    this.addSql(`drop table if exists "sandbox_secret_binding" cascade;`);
    this.addSql(`drop table if exists "sandbox_placement" cascade;`);
    this.addSql(`drop table if exists "secret_delivery_event" cascade;`);
    this.addSql(`drop table if exists "early_session_failure" cascade;`);
    this.addSql(`drop table if exists "sandbox_observed_status" cascade;`);
    this.addSql(`drop table if exists "sandbox_last_activity" cascade;`);
    this.addSql(`drop table if exists "sandbox_fork" cascade;`);
    this.addSql(`drop table if exists "machine_spot_check" cascade;`);
    this.addSql(`drop table if exists "machine_reliability_event" cascade;`);
    this.addSql(`drop table if exists "sandbox_exposure" cascade;`);
    this.addSql(`drop table if exists "sandbox_exposure_reconciliation" cascade;`);
    this.addSql(`drop table if exists "sandbox_exposure_backend" cascade;`);
    this.addSql(`drop table if exists "sandbox_custom_domain" cascade;`);
    this.addSql(`drop table if exists "api_key_budget" cascade;`);
    this.addSql(`drop table if exists "member" cascade;`);
    this.addSql(`drop trigger if exists "machine_price_card_immutable" on "machine_price_card";`);
    this.addSql(`drop function if exists "machine_price_card_machine_price_card_immutable_fn"();`);
    this.addSql(`drop table if exists "machine_price_card" cascade;`);
    this.addSql(`drop table if exists "placement_price" cascade;`);
    this.addSql(`drop table if exists "sandbox_usage_periods_archive" cascade;`);
    this.addSql(`drop table if exists "sandbox_usage_periods" cascade;`);
    this.addSql(`drop table if exists "sandbox_billable_usage" cascade;`);
    this.addSql(`drop table if exists "placement_billing_authorization" cascade;`);
    this.addSql(`drop table if exists "payment_channel_charge" cascade;`);
    this.addSql(`drop table if exists "network_usage_period" cascade;`);
    this.addSql(`drop table if exists "machine_usage_receipt" cascade;`);
    this.addSql(`drop table if exists "exposure_network_usage" cascade;`);
    this.addSql(`drop table if exists "billing_line_item" cascade;`);
    this.addSql(`drop table if exists "billing_line_quarantine" cascade;`);
    this.addSql(`drop table if exists "billing_line_adjustment" cascade;`);
    this.addSql(`drop table if exists "billing_evidence_bundle" cascade;`);
    this.addSql(`drop table if exists "machine_listing" cascade;`);
    this.addSql(`drop table if exists "invitation" cascade;`);
    this.addSql(`drop table if exists "account" cascade;`);
    this.addSql(`drop table if exists "abuse_case" cascade;`);
    this.addSql(`drop table if exists "abuse_report" cascade;`);
    this.addSql(`drop table if exists "abuse_evidence" cascade;`);
    this.addSql(`drop table if exists "abuse_case_action" cascade;`);
    this.addSql(`drop table if exists "user_wallet" cascade;`);
    this.addSql(`drop table if exists "verification_review" cascade;`);
    this.addSql(`drop table if exists "volume" cascade;`);
    this.addSql(`drop table if exists "volume_backup" cascade;`);
    this.addSql(`drop table if exists "wallet_transaction" cascade;`);
    this.addSql(`drop table if exists "settlement_transaction" cascade;`);
    this.addSql(`drop table if exists "claim_attempt" cascade;`);
    this.addSql(`drop table if exists "webhook_endpoint" cascade;`);
    this.addSql(`drop table if exists "webhook_message" cascade;`);
    this.addSql(`drop table if exists "webhook_delivery" cascade;`);
    this.addSql(`drop table if exists "webhook_delivery_attempt" cascade;`);

    this.addSql(`drop type "job_status_enum";`);
    this.addSql(`drop type "job_resourcetype_enum";`);
    this.addSql(`drop type "job_projection_status_enum";`);
    this.addSql(`drop type "machine_snapshot_target_reason_enum";`);
    this.addSql(`drop type "snapshot_machine_state_enum";`);
    this.addSql(`drop type "user_role_enum";`);
    this.addSql(`drop type "snapshot_state_enum";`);
    this.addSql(`drop type "continent_enum";`);
    this.addSql(`drop type "machine_state_enum";`);
    this.addSql(`drop type "docker_registry_registrytype_enum";`);
    this.addSql(`drop type "sandbox_mode_enum";`);
    this.addSql(`drop type "sandbox_state_enum";`);
    this.addSql(`drop type "sandbox_desiredstate_enum";`);
    this.addSql(`drop type "sandbox_backupstate_enum";`);
    this.addSql(`drop type "volume_backup_state_enum";`);
    this.addSql(`drop type "volume_state_enum";`);
  }

}
