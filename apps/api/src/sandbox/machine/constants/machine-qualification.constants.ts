/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const MACHINE_QUALIFICATION_SCHEMA_VERSION = 2 as const;
export const MACHINE_QUALIFICATION_POLICY = {
	VERSION: 2,
	AUDIENCE: 'snapflow-control-plane',
	CHALLENGE_TTL_SECONDS: 300,
	QUALIFICATION_TTL_HOURS: 24,
	RENEWAL_LEAD_HOURS: 2,
	MAXIMUM_DURATION_SECONDS: 120,
	DISK_SAMPLE_BYTES: 8 * 1024 * 1024,
	CPU_ITERATIONS: 100_000,
	CANARY_CPU: 1,
	CANARY_MEMORY_GIB: 1,
	CANARY_STORAGE_GIB: 1,
} as const;

export const MACHINE_QUALIFICATION_CANARY_SNAPSHOT =
	'docker.io/library/alpine@sha256:48b0309ca019d89d40f670aa1bc06e426dc0931948452e8491e3d65087abc07d';

export const MACHINE_QUALIFICATION_STATE = {
	PENDING: 'pending',
	ACCEPTED: 'accepted',
	REJECTED: 'rejected',
	EXPIRED: 'expired',
} as const;
export type MachineQualificationState =
	(typeof MACHINE_QUALIFICATION_STATE)[keyof typeof MACHINE_QUALIFICATION_STATE];

export const MACHINE_QUALIFICATION_VERDICT = {
	ACCEPTED: 'accepted',
	REJECTED: 'rejected',
} as const;
export type MachineQualificationVerdict =
	(typeof MACHINE_QUALIFICATION_VERDICT)[keyof typeof MACHINE_QUALIFICATION_VERDICT];

export const MACHINE_QUALIFICATION_CHECK = {
	RUNTIME_HEALTH: 'runtime_health',
	STORAGE_IO: 'storage_io',
	CPU_BOUNDED_WORK: 'cpu_bounded_work',
	MACHINE_IDENTITY: 'machine_identity',
	CANARY_MICROVM: 'canary_microvm',
} as const;

export const MACHINE_QUALIFICATION_REASON = {
	ACCEPTED: 'accepted',
	MALFORMED_EVIDENCE: 'malformed_evidence',
	EXPIRED: 'challenge_expired',
	REPLAYED: 'challenge_replayed',
	WRONG_SESSION: 'wrong_session',
	WRONG_KEY: 'wrong_machine_key',
	WRONG_POLICY: 'wrong_policy',
	WRONG_ENVIRONMENT: 'environment_changed',
	SIGNATURE_INVALID: 'signature_invalid',
	CHECK_FAILED: 'functional_check_failed',
} as const;

export const MACHINE_QUALIFICATION_LIMITS = {
	NONCE_BYTES: 32,
	DIGEST_LENGTH: 71,
	STATE_LENGTH: 32,
	VERDICT_LENGTH: 32,
	SIGNATURE_LENGTH: 128,
	CHECK_ID_LENGTH: 64,
	REASON_CODE_LENGTH: 96,
	AUDIENCE_LENGTH: 128,
	MACHINE_KEY_ID_LENGTH: 128,
	NONCE_MIN_LENGTH: 32,
	NONCE_MAX_LENGTH: 128,
	METRIC_NAME_LENGTH: 64,
	MAX_CHECKS: 16,
	MAX_REASON_CODES: 16,
} as const;

export const MACHINE_QUALIFICATION_RATE_LIMIT = {
	MINIMUM_INTERVAL_SECONDS: 600,
} as const;
