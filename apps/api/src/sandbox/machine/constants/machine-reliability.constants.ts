/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const JOB_EXECUTION_RESULT_SCHEMA_VERSION = 1 as const;

export const MACHINE_RELIABILITY_EVENT_KIND = {
	JOB_COMPLETION: 'job_completion',
	SANDBOX_CONVERGENCE: 'sandbox_convergence',
	LEASE_EXPIRED: 'lease_expired',
	CONVERGENCE_DEADLINE_MISSED: 'convergence_deadline_missed',
	CREATE_UNOBSERVED: 'create_unobserved',
	EDGE_SERVED: 'edge_served',
} as const;
export type MachineReliabilityEventKind =
	(typeof MACHINE_RELIABILITY_EVENT_KIND)[keyof typeof MACHINE_RELIABILITY_EVENT_KIND];

export const MACHINE_RELIABILITY_SOURCE = {
	MACHINE: 'machine',
	PLATFORM: 'platform',
} as const;
export type MachineReliabilitySource =
	(typeof MACHINE_RELIABILITY_SOURCE)[keyof typeof MACHINE_RELIABILITY_SOURCE];

export const JOB_EXECUTION_OUTCOME = {
	SUCCEEDED: 'succeeded',
	FAILED: 'failed',
} as const;
export type JobExecutionOutcome =
	(typeof JOB_EXECUTION_OUTCOME)[keyof typeof JOB_EXECUTION_OUTCOME];

export const JOB_LIFECYCLE_PHASE = {
	ADMISSION: 'admission',
	IMAGE: 'image',
	STORAGE: 'storage',
	HYPERVISOR: 'hypervisor',
	GUEST_READINESS: 'guest_readiness',
	GUEST_SERVICE: 'guest_service',
	NETWORK: 'network',
	WORKLOAD: 'workload',
	CLEANUP: 'cleanup',
	UNKNOWN: 'unknown',
} as const;
export type JobLifecyclePhase =
	(typeof JOB_LIFECYCLE_PHASE)[keyof typeof JOB_LIFECYCLE_PHASE];

export const MACHINE_FAULT_DOMAIN = {
	MACHINE: 'machine',
	WORKLOAD: 'workload',
	CUSTOMER_CONFIGURATION: 'customer_configuration',
	CONTROL_PLANE: 'control_plane',
	EXTERNAL: 'external',
	UNKNOWN: 'unknown',
} as const;
export type MachineFaultDomain =
	(typeof MACHINE_FAULT_DOMAIN)[keyof typeof MACHINE_FAULT_DOMAIN];

export const MACHINE_RELIABILITY_OUTCOME = {
	SUCCESS: 'success',
	FAILURE: 'failure',
	UNATTRIBUTED: 'unattributed',
	NEUTRAL: 'neutral',
} as const;
export type MachineReliabilityOutcome =
	(typeof MACHINE_RELIABILITY_OUTCOME)[keyof typeof MACHINE_RELIABILITY_OUTCOME];

export const MACHINE_RELIABILITY_SEVERITY = {
	INFO: 'info',
	WARNING: 'warning',
	ERROR: 'error',
} as const;
export type MachineReliabilitySeverity =
	(typeof MACHINE_RELIABILITY_SEVERITY)[keyof typeof MACHINE_RELIABILITY_SEVERITY];

export const MACHINE_RELIABILITY_LIMITS = {
	WORKLOAD_FINGERPRINT: 71,
	EVENT_KIND: 64,
	SOURCE: 16,
	PHASE: 32,
	OUTCOME: 16,
	SEVERITY: 16,
	FAULT_DOMAIN: 32,
	DEDUPLICATION_KEY: 255,
	EVIDENCE_DIGEST: 64,
	ERROR_CODE: 96,
	DIAGNOSTIC: 512,
	EVIDENCE_FIELDS: 32,
	EVIDENCE_KEY: 64,
	IDENTITY: 256,
	TIMING_FIELDS: 32,
} as const;

export const PLATFORM_RELIABILITY_REASON = {
	LEASE_EXPIRED: 'PLATFORM_LEASE_EXPIRED',
	CONVERGENCE_DEADLINE_MISSED: 'PLATFORM_CONVERGENCE_DEADLINE_MISSED',
	CREATE_UNOBSERVED: 'PLATFORM_CREATE_UNOBSERVED',
	EDGE_SERVED: 'PLATFORM_EDGE_SERVED',
} as const;

export const MACHINE_ATTRIBUTION_SUBJECT = {
	WORKLOAD: 'workload',
	CUSTOMER: 'customer',
} as const;
export type MachineAttributionSubject =
	(typeof MACHINE_ATTRIBUTION_SUBJECT)[keyof typeof MACHINE_ATTRIBUTION_SUBJECT];

export const MACHINE_WORKLOAD_OUTCOME_CLASS = {
	SUCCESS: 'success',
	FAILURE: 'failure',
} as const;
export type MachineWorkloadOutcomeClass =
	(typeof MACHINE_WORKLOAD_OUTCOME_CLASS)[keyof typeof MACHINE_WORKLOAD_OUTCOME_CLASS];

export const MACHINE_WORKLOAD_OUTCOME_REFRESH_MINUTES = 60;
