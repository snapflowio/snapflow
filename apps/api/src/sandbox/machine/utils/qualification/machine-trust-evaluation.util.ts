/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	MACHINE_TRUST_POLICY,
	MachineRestrictionReason,
	MINIMUM_CONFIDENT_SAMPLES,
} from '../../../../billing/constants/machine-trust.constants';
import { BASIS_POINTS_SCALE } from '../../../../common/constants/money.constants';
import { BasisPoints } from '../../../../common/values/basis-points.value';

const WILSON_VARIANCE_CORRECTION_FACTOR = 4;

export interface MachineOutcomeMass {
	successful: number;
	machineFailures: number;
	unattributedFailures: number;
}

export interface MachineAttestationMass {
	windowMass: number;
	intendedMicroUsd: number;
	unattestedMicroUsd: number;
}

export interface MachineTrustEvidence {
	outcomes: MachineOutcomeMass;
	attestation: MachineAttestationMass;
}

export interface MachineTrustScores {
	reliabilityBasisPoints: number;
	attestationBasisPoints: number;
	healthBasisPoints: number;
}

export function scoreMachineTrust(
	evidence: MachineTrustEvidence
): MachineTrustScores {
	const failures = failureMass(evidence.outcomes);
	return {
		reliabilityBasisPoints: toBasisPoints(
			wilsonLowerBound(
				evidence.outcomes.successful,
				evidence.outcomes.successful + failures,
				MACHINE_TRUST_POLICY.reliabilityZScore
			)
		),
		attestationBasisPoints: toBasisPoints(
			attestationShare(evidence.attestation)
		),
		healthBasisPoints: toBasisPoints(
			(1 - confidentFailureRate(evidence.outcomes)) *
				countedAttestationShare(evidence.attestation)
		),
	};
}

function tolerableFailureRate(peerFailureRate: number | null): number {
	return Math.max(
		1 - MACHINE_TRUST_POLICY.createSuccessObjective,
		peerFailureRate ?? 0
	);
}

export function machineTrustTrip(
	evidence: MachineTrustEvidence,
	recentFraudulentLines: number,
	peerFailureRate: number | null
): MachineRestrictionReason | null {
	if (recentFraudulentLines > 0) {
		return MachineRestrictionReason.EVIDENCE_QUARANTINED;
	}
	if (
		confidentFailureRate(evidence.outcomes) >
		tolerableFailureRate(peerFailureRate)
	) {
		return MachineRestrictionReason.RELIABILITY_DEGRADED;
	}
	if (
		countedAttestationShare(evidence.attestation) * BASIS_POINTS_SCALE <
		MACHINE_TRUST_POLICY.restrictAttestationBasisPoints
	) {
		return MachineRestrictionReason.USAGE_ATTESTATION_INSUFFICIENT;
	}
	return null;
}

function confidentFailureRate(outcomes: MachineOutcomeMass): number {
	const failures = failureMass(outcomes);
	const samples = outcomes.successful + failures;
	if (samples < MINIMUM_CONFIDENT_SAMPLES) return 0;
	return wilsonLowerBound(failures, samples, MACHINE_TRUST_POLICY.tripZScore);
}

export function failureMass(outcomes: MachineOutcomeMass): number {
	return (
		outcomes.machineFailures +
		outcomes.unattributedFailures *
			MACHINE_TRUST_POLICY.unattributedFailureWeight
	);
}

function countedAttestationShare(attestation: MachineAttestationMass): number {
	return attestation.windowMass >=
		MACHINE_TRUST_POLICY.minimumAttestationWindowMass
		? attestationShare(attestation)
		: 1;
}

function attestationShare(attestation: MachineAttestationMass): number {
	if (attestation.intendedMicroUsd <= 0) return 1;
	return Math.min(
		1,
		Math.max(
			0,
			(attestation.intendedMicroUsd - attestation.unattestedMicroUsd) /
				attestation.intendedMicroUsd
		)
	);
}

function wilsonLowerBound(
	successes: number,
	samples: number,
	zScore: number
): number {
	if (samples <= 0) return 0;
	const proportion = successes / samples;
	const zSquared = zScore ** 2;
	const denominator = 1 + zSquared / samples;
	const center = proportion + zSquared / (2 * samples);
	const margin =
		zScore *
		Math.sqrt(
			(proportion * (1 - proportion) +
				zSquared / (WILSON_VARIANCE_CORRECTION_FACTOR * samples)) /
				samples
		);
	return Math.max(0, (center - margin) / denominator);
}

export function toBasisPoints(share: number): number {
	return BasisPoints.fromShare(share).toNumber();
}
