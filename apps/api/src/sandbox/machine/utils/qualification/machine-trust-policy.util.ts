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
	type MachineRestrictionReason,
	MachineTrustHoldReason,
	MachineTrustStage,
	MINIMUM_CONFIDENT_SAMPLES,
} from '../../../../billing/ledger/constants/machine-trust.constants';
import {
	MILLISECONDS_PER_DAY,
	MILLISECONDS_PER_MINUTE,
} from '../../../../common/constants/time.constants';
import {
	addMilliseconds,
	millisecondsBetween,
} from '../../../../common/utils/time.util';
import { SLOW_START_INITIAL_WINDOW } from '../../constants/machine-placement.constants';
import {
	type MachineTrustEvidence,
	type MachineTrustScores,
	machineTrustTrip,
	scoreMachineTrust,
	toBasisPoints,
} from './machine-trust-evaluation.util';

const OBJECTIVE_BASIS_POINTS = toBasisPoints(
	MACHINE_TRUST_POLICY.createSuccessObjective
);

export interface MachineBreakerState {
	trustStage: MachineTrustStage;
	restrictedUntil: Date | null;
	probationEndsAt: Date | null;
	evidenceSince: Date | null;
	releasedAt: Date | null;
	relapseCount: number;
	restrictionReason: MachineRestrictionReason | null;
}

export interface MachineTrustInput {
	previous: MachineBreakerState;
	window: MachineTrustEvidence;
	recent: MachineTrustEvidence;
	recentFraudulentLines: number;
	recentPlatformSuccesses: number;
	qualifiedAt: Date | null;
	peerFailureRate: number | null;
	uptimeBasisPoints: number;
	now: Date;
}

export interface MachineTrustDecision extends MachineBreakerState {
	window: MachineTrustScores;
	recent: MachineTrustScores;
	holdReasons: string[];
}

export function decideMachineTrust(
	input: MachineTrustInput
): MachineTrustDecision {
	const scores = {
		window: scoreMachineTrust(input.window),
		recent: scoreMachineTrust(input.recent),
	};
	const { previous } = input;
	if (previous.trustStage === MachineTrustStage.RESTRICTED) {
		return restrictedDecision(input, scores);
	}
	const trip = machineTrustTrip(
		input.recent,
		input.recentFraudulentLines,
		input.peerFailureRate
	);
	if (trip) return restrict(input, scores, trip);
	if (
		previous.trustStage === MachineTrustStage.RECOVERING &&
		!probationPassed(input)
	) {
		return { ...previous, ...scores, holdReasons: [] };
	}
	const released = previous.trustStage === MachineTrustStage.RECOVERING;
	const releasedAt = released ? input.now : previous.releasedAt;
	const relapseCount =
		releasedAt &&
		millisecondsBetween(releasedAt, input.now) >=
			MACHINE_TRUST_POLICY.relapseResetDays * MILLISECONDS_PER_DAY
			? 0
			: previous.relapseCount;
	return {
		...previous,
		...scores,
		trustStage: closedStage(input, scores.window, relapseCount),
		restrictedUntil: null,
		probationEndsAt: null,
		releasedAt,
		relapseCount,
		holdReasons: [],
	};
}

function probationPassed(input: MachineTrustInput): boolean {
	const { probationEndsAt } = input.previous;
	return (
		probationEndsAt !== null &&
		input.now >= probationEndsAt &&
		input.recentPlatformSuccesses >= MINIMUM_CONFIDENT_SAMPLES
	);
}

function restrictedDecision(
	input: MachineTrustInput,
	scores: Pick<MachineTrustDecision, 'window' | 'recent'>
): MachineTrustDecision {
	const { previous, now, qualifiedAt } = input;
	const restrictedUntil = previous.restrictedUntil ?? now;
	if (now < restrictedUntil) {
		return {
			...previous,
			...scores,
			holdReasons: [MachineTrustHoldReason.COOLDOWN],
		};
	}
	if (!qualifiedAt || qualifiedAt < restrictedUntil) {
		return {
			...previous,
			...scores,
			holdReasons: [MachineTrustHoldReason.REQUALIFICATION_REQUIRED],
		};
	}
	return {
		...previous,
		...scores,
		trustStage: MachineTrustStage.RECOVERING,
		evidenceSince: now,
		probationEndsAt: addMilliseconds(
			now,
			backoffMinutes(
				MACHINE_TRUST_POLICY.probationBaseMinutes,
				MACHINE_TRUST_POLICY.probationMaximumMinutes,
				previous.relapseCount
			) * MILLISECONDS_PER_MINUTE
		),
		holdReasons: [],
	};
}

function restrict(
	input: MachineTrustInput,
	scores: Pick<MachineTrustDecision, 'window' | 'recent'>,
	reason: MachineRestrictionReason
): MachineTrustDecision {
	const { previous, now } = input;
	const relapseCount = previous.relapseCount + 1;
	return {
		...previous,
		...scores,
		trustStage: MachineTrustStage.RESTRICTED,
		restrictedUntil: addMilliseconds(
			now,
			backoffMinutes(
				MACHINE_TRUST_POLICY.cooldownBaseMinutes,
				MACHINE_TRUST_POLICY.cooldownMaximumMinutes,
				relapseCount
			) * MILLISECONDS_PER_MINUTE
		),
		probationEndsAt: null,
		relapseCount,
		restrictionReason: reason,
		holdReasons: [MachineTrustHoldReason.COOLDOWN],
	};
}

function closedStage(
	input: MachineTrustInput,
	window: MachineTrustScores,
	relapseCount: number
): MachineTrustStage {
	return relapseCount === 0 &&
		window.reliabilityBasisPoints >= OBJECTIVE_BASIS_POINTS &&
		window.attestationBasisPoints >=
			MACHINE_TRUST_POLICY.establishedAttestationBasisPoints &&
		input.uptimeBasisPoints >= OBJECTIVE_BASIS_POINTS
		? MachineTrustStage.ESTABLISHED
		: MachineTrustStage.PROBATIONARY;
}

function backoffMinutes(
	baseMinutes: number,
	maximumMinutes: number,
	relapseCount: number
): number {
	return Math.min(
		maximumMinutes,
		baseMinutes *
			MACHINE_TRUST_POLICY.backoffMultiplier ** Math.max(0, relapseCount - 1)
	);
}

export function machinePlacementWindow(
	trustStage: MachineTrustStage,
	successes: number,
	recentPlatformSuccesses: number
): number {
	return (
		SLOW_START_INITIAL_WINDOW +
		(trustStage === MachineTrustStage.RECOVERING
			? recentPlatformSuccesses
			: successes)
	);
}
