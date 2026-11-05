/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createHash } from 'node:crypto';
import { canonicalJson } from '../../../../common/utils/canonical-json.util';
import { ResourceShape } from '../../../../common/values/resource-shape.value';
import type { Sandbox } from '../../../entities/sandbox.entity';
import type { JobExecutionResult } from '../../../machine-job/types/job-execution-result.types';
import {
	JOB_EXECUTION_OUTCOME,
	MACHINE_FAULT_DOMAIN,
	MACHINE_RELIABILITY_LIMITS,
	MACHINE_RELIABILITY_OUTCOME,
	MACHINE_RELIABILITY_SEVERITY,
	type MachineFaultDomain,
	type MachineReliabilityOutcome,
	type MachineReliabilitySeverity,
} from '../../constants/machine-reliability.constants';
import { claimedFaultDomain } from '../machine-error-code.util';
import { machineWorkloadFingerprint } from '../machine-workload-fingerprint.util';

type EvidenceFields = Record<string, string | number | boolean>;

export function reportedFaultDomain(
	result: JobExecutionResult
): MachineFaultDomain {
	if (result.outcome === JOB_EXECUTION_OUTCOME.SUCCEEDED) {
		return MACHINE_FAULT_DOMAIN.UNKNOWN;
	}
	return claimedFaultDomain(result.errorCode);
}

export function reportedOutcome(
	result: JobExecutionResult,
	faultDomain: MachineFaultDomain
): MachineReliabilityOutcome {
	if (result.outcome === JOB_EXECUTION_OUTCOME.SUCCEEDED) {
		return MACHINE_RELIABILITY_OUTCOME.SUCCESS;
	}
	switch (faultDomain) {
		case MACHINE_FAULT_DOMAIN.MACHINE:
			return MACHINE_RELIABILITY_OUTCOME.FAILURE;
		case MACHINE_FAULT_DOMAIN.UNKNOWN:
			return MACHINE_RELIABILITY_OUTCOME.UNATTRIBUTED;
		default:
			return MACHINE_RELIABILITY_OUTCOME.NEUTRAL;
	}
}

export function reliabilitySeverity(
	outcome: MachineReliabilityOutcome
): MachineReliabilitySeverity {
	switch (outcome) {
		case MACHINE_RELIABILITY_OUTCOME.FAILURE:
			return MACHINE_RELIABILITY_SEVERITY.ERROR;
		case MACHINE_RELIABILITY_OUTCOME.UNATTRIBUTED:
		case MACHINE_RELIABILITY_OUTCOME.NEUTRAL:
			return MACHINE_RELIABILITY_SEVERITY.WARNING;
		case MACHINE_RELIABILITY_OUTCOME.SUCCESS:
			return MACHINE_RELIABILITY_SEVERITY.INFO;
	}
}

export function sandboxWorkloadFingerprint(
	sandbox: Sandbox | null
): string | null {
	if (!sandbox) return null;
	return machineWorkloadFingerprint({
		snapshot: sandbox.snapshot ?? null,
		sandboxClass: sandbox.sandboxClass,
		mode: sandbox.mode,
		capabilities: sandbox.capabilities,
		...ResourceShape.fromSandbox(sandbox),
	});
}

export function sanitizeEvidence(
	input: EvidenceFields | undefined
): EvidenceFields {
	if (!input) return {};
	return Object.fromEntries(
		Object.entries(input)
			.sort(([left], [right]) => left.localeCompare(right))
			.slice(0, MACHINE_RELIABILITY_LIMITS.EVIDENCE_FIELDS)
			.map(([key, value]) => [
				key.slice(0, MACHINE_RELIABILITY_LIMITS.EVIDENCE_KEY),
				value,
			])
	);
}

function sanitizeTimings(
	input: Record<string, number> | undefined
): Record<string, number> {
	if (!input) return {};
	return Object.fromEntries(
		Object.entries(input)
			.filter(([, value]) => Number.isFinite(value) && value >= 0)
			.sort(([left], [right]) => left.localeCompare(right))
			.slice(0, MACHINE_RELIABILITY_LIMITS.TIMING_FIELDS)
			.map(([key, value]) => [
				key.slice(0, MACHINE_RELIABILITY_LIMITS.EVIDENCE_KEY),
				value,
			])
	);
}

export function reliabilityEvidenceDigest(
	identity: Record<string, string | number | null>,
	result: JobExecutionResult | null,
	evidence: EvidenceFields
): string {
	return createHash('sha256')
		.update(
			canonicalJson({
				...identity,
				...(result
					? {
							phase: result.phase,
							errorCode: result.errorCode,
							retryable: result.retryable,
							runtimeIdentity: result.runtimeIdentity,
							releaseIdentity: result.releaseIdentity,
							timingsMs: sanitizeTimings(result.timingsMs),
						}
					: {}),
				evidence,
			})
		)
		.digest('hex');
}
