/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EVIDENCE_QUARANTINED } from './billing.constants';

export const MachineTrustStage = {
	PROBATIONARY: 'probationary',
	ESTABLISHED: 'established',
	RESTRICTED: 'restricted',
	RECOVERING: 'recovering',
} as const;

export type MachineTrustStage =
	(typeof MachineTrustStage)[keyof typeof MachineTrustStage];

export const MachineRestrictionReason = {
	RELIABILITY_DEGRADED: 'reliability_degraded',
	USAGE_ATTESTATION_INSUFFICIENT: 'usage_attestation_insufficient',
	EVIDENCE_QUARANTINED,
} as const;

export type MachineRestrictionReason =
	(typeof MachineRestrictionReason)[keyof typeof MachineRestrictionReason];

export const MACHINE_TRUST_LIMITS = {
	RESTRICTION_REASON: 64,
} as const;

export const MachineTrustHoldReason = {
	COOLDOWN: 'trust_cooldown',
	REQUALIFICATION_REQUIRED: 'trust_requalification_required',
} as const;

export const MACHINE_TRUST_POLICY = {
	version: 10,
	observationWindowDays: 30,
	evidenceHalfLifeHours: 168,
	reliabilityZScore: 1.96,
	tripZScore: 1.645,
	createSuccessObjective: 0.95,
	unattributedFailureWeight: 0.5,
	machineReportedSuccessWeight: 0.5,
	minimumAttestationWindowMass: 10,
	restrictAttestationBasisPoints: 9_000,
	establishedAttestationBasisPoints: 9_900,
	cooldownBaseMinutes: 15,
	cooldownMaximumMinutes: 1_440,
	probationBaseMinutes: 60,
	probationMaximumMinutes: 10_080,
	backoffMultiplier: 2,
	relapseResetDays: 7,
	reassessmentIntervalMinutes: 5,
	reassessmentBatchSize: 100,
} as const;

export const MAJORITY_SHARE = 0.5;

export const MINIMUM_CONFIDENT_SAMPLES = Math.ceil(
	MACHINE_TRUST_POLICY.tripZScore ** 2
);

const MACHINE_RELIABILITY_RETENTION_MARGIN_DAYS = 1;

export const MACHINE_RELIABILITY_RETENTION = {
	retentionDays:
		MACHINE_TRUST_POLICY.observationWindowDays +
		MACHINE_RELIABILITY_RETENTION_MARGIN_DAYS,
	batchSize: 1_000,
	maximumBatches: 100,
} as const;

export const HALF_LIFE_DECAY_BASE = 0.5;
