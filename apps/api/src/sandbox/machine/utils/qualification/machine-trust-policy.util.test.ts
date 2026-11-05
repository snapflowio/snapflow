/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	MACHINE_TRUST_POLICY,
	MachineRestrictionReason,
	MachineTrustHoldReason,
	MachineTrustStage,
	MINIMUM_CONFIDENT_SAMPLES,
} from '../../../../billing/constants/machine-trust.constants';
import {
	MILLISECONDS_PER_DAY,
	MILLISECONDS_PER_MINUTE,
} from '../../../../common/constants/time.constants';
import type { MachineTrustEvidence } from './machine-trust-evaluation.util';
import {
	decideMachineTrust,
	type MachineBreakerState,
	type MachineTrustDecision,
	machinePlacementWindow,
} from './machine-trust-policy.util';

const START = new Date('2026-10-04T12:00:00.000Z');
const ESTABLISHED_SAMPLES = 400;
const FULL_UPTIME_BASIS_POINTS = 10_000;
const PLATFORM_SUCCESSES = MINIMUM_CONFIDENT_SAMPLES;

const CLOSED: MachineBreakerState = {
	trustStage: MachineTrustStage.PROBATIONARY,
	restrictedUntil: null,
	probationEndsAt: null,
	evidenceSince: null,
	releasedAt: null,
	relapseCount: 0,
	restrictionReason: null,
};

function outcomes(successful: number, machineFailures: number) {
	return {
		outcomes: {
			successful,
			machineFailures,
			unattributedFailures: 0,
		},
		attestation: {
			windowMass: 0,
			intendedMicroUsd: 0,
			unattestedMicroUsd: 0,
		},
	} satisfies MachineTrustEvidence;
}

const FAILING = outcomes(2, 8);
const CLEAN = outcomes(ESTABLISHED_SAMPLES, 0);
const QUIET = outcomes(0, 0);

function minutes(count: number): number {
	return count * MILLISECONDS_PER_MINUTE;
}

function at(offsetMilliseconds: number): Date {
	return new Date(START.getTime() + offsetMilliseconds);
}

function decide(
	previous: MachineBreakerState,
	recent: MachineTrustEvidence,
	now: Date,
	qualifiedAt: Date | null = null,
	signals: { platformSuccesses?: number; fraudulentLines?: number } = {}
): MachineTrustDecision {
	return decideMachineTrust({
		previous,
		window: recent,
		recent,
		recentFraudulentLines: signals.fraudulentLines ?? 0,
		recentPlatformSuccesses: signals.platformSuccesses ?? PLATFORM_SUCCESSES,
		qualifiedAt,
		peerFailureRate: null,
		uptimeBasisPoints: FULL_UPTIME_BASIS_POINTS,
		now,
	});
}

function restrictAndRecover(previous: MachineBreakerState, now: Date) {
	const restricted = decide(previous, FAILING, now);
	const cooledDown = restricted.restrictedUntil;
	assert.ok(cooledDown);
	const recovering = decide(restricted, QUIET, cooledDown, cooledDown);
	return { restricted, recovering };
}

describe('decideMachineTrust', () => {
	it('restricts a machine whose recent evidence is unhealthy', () => {
		const decision = decide(CLOSED, FAILING, START);
		assert.equal(decision.trustStage, MachineTrustStage.RESTRICTED);
		assert.equal(
			decision.restrictionReason,
			MachineRestrictionReason.RELIABILITY_DEGRADED
		);
		assert.equal(decision.relapseCount, 1);
		assert.deepEqual(
			decision.restrictedUntil,
			at(minutes(MACHINE_TRUST_POLICY.cooldownBaseMinutes))
		);
		assert.deepEqual(decision.holdReasons, [MachineTrustHoldReason.COOLDOWN]);
	});

	it('holds a restricted machine through its cooldown', () => {
		const restricted = decide(CLOSED, FAILING, START);
		const during = decide(restricted, QUIET, at(minutes(1)), at(minutes(1)));
		assert.equal(during.trustStage, MachineTrustStage.RESTRICTED);
		assert.deepEqual(during.holdReasons, [MachineTrustHoldReason.COOLDOWN]);
	});

	it('requires a qualification completed after the cooldown before probation', () => {
		const restricted = decide(CLOSED, FAILING, START);
		const cooledDown = restricted.restrictedUntil;
		assert.ok(cooledDown);
		const stale = decide(restricted, QUIET, cooledDown, START);
		assert.equal(stale.trustStage, MachineTrustStage.RESTRICTED);
		assert.deepEqual(stale.holdReasons, [
			MachineTrustHoldReason.REQUALIFICATION_REQUIRED,
		]);
		const requalified = decide(restricted, QUIET, cooledDown, cooledDown);
		assert.equal(requalified.trustStage, MachineTrustStage.RECOVERING);
		assert.deepEqual(requalified.holdReasons, []);
		assert.deepEqual(requalified.evidenceSince, cooledDown);
		assert.deepEqual(
			requalified.probationEndsAt,
			new Date(
				cooledDown.getTime() +
					minutes(MACHINE_TRUST_POLICY.probationBaseMinutes)
			)
		);
	});

	it('releases a machine after a clean probation', () => {
		const { recovering } = restrictAndRecover(CLOSED, START);
		const probationEndsAt = recovering.probationEndsAt;
		assert.ok(probationEndsAt);
		const midway = decide(recovering, CLEAN, at(minutes(30)));
		assert.equal(midway.trustStage, MachineTrustStage.RECOVERING);
		const released = decide(recovering, CLEAN, probationEndsAt);
		assert.equal(released.trustStage, MachineTrustStage.PROBATIONARY);
		assert.deepEqual(released.releasedAt, probationEndsAt);
		assert.equal(released.relapseCount, 1);
	});

	it('re-restricts a relapse during probation with a doubled cooldown and probation', () => {
		const first = restrictAndRecover(CLOSED, START);
		const relapseAt = at(minutes(MACHINE_TRUST_POLICY.cooldownBaseMinutes + 5));
		const second = restrictAndRecover(first.recovering, relapseAt);
		assert.equal(second.restricted.relapseCount, 2);
		assert.deepEqual(
			second.restricted.restrictedUntil,
			new Date(
				relapseAt.getTime() +
					minutes(
						MACHINE_TRUST_POLICY.cooldownBaseMinutes *
							MACHINE_TRUST_POLICY.backoffMultiplier
					)
			)
		);
		const secondProbation = second.recovering.probationEndsAt;
		const secondStart = second.recovering.evidenceSince;
		assert.ok(secondProbation && secondStart);
		assert.equal(
			secondProbation.getTime() - secondStart.getTime(),
			minutes(
				MACHINE_TRUST_POLICY.probationBaseMinutes *
					MACHINE_TRUST_POLICY.backoffMultiplier
			)
		);
	});

	it('caps the escalated cooldown and probation', () => {
		const relapses = 20;
		const decision = decide(
			{ ...CLOSED, relapseCount: relapses },
			FAILING,
			START
		);
		assert.deepEqual(
			decision.restrictedUntil,
			at(minutes(MACHINE_TRUST_POLICY.cooldownMaximumMinutes))
		);
	});

	it('forgives relapses after the reset period and lets the machine establish again', () => {
		const { recovering } = restrictAndRecover(CLOSED, START);
		const probationEndsAt = recovering.probationEndsAt;
		assert.ok(probationEndsAt);
		const released = decide(recovering, CLEAN, probationEndsAt);
		assert.equal(released.trustStage, MachineTrustStage.PROBATIONARY);
		const later = new Date(
			probationEndsAt.getTime() +
				MACHINE_TRUST_POLICY.relapseResetDays * MILLISECONDS_PER_DAY
		);
		const forgiven = decide(released, CLEAN, later);
		assert.equal(forgiven.relapseCount, 0);
		assert.equal(forgiven.trustStage, MachineTrustStage.ESTABLISHED);
	});

	it('never releases a probation on silence', () => {
		const { recovering } = restrictAndRecover(CLOSED, START);
		const probationEndsAt = recovering.probationEndsAt;
		assert.ok(probationEndsAt);
		const silent = decide(recovering, QUIET, probationEndsAt, null, {
			platformSuccesses: 0,
		});
		assert.equal(silent.trustStage, MachineTrustStage.RECOVERING);
		const short = decide(recovering, CLEAN, probationEndsAt, null, {
			platformSuccesses: PLATFORM_SUCCESSES - 1,
		});
		assert.equal(short.trustStage, MachineTrustStage.RECOVERING);
		const proven = decide(recovering, CLEAN, probationEndsAt, null, {
			platformSuccesses: PLATFORM_SUCCESSES,
		});
		assert.equal(proven.trustStage, MachineTrustStage.PROBATIONARY);
	});

	it('restricts on one proven evidence fraud despite a clean record', () => {
		const decision = decide(CLOSED, CLEAN, START, null, { fraudulentLines: 1 });
		assert.equal(decision.trustStage, MachineTrustStage.RESTRICTED);
		assert.equal(
			decision.restrictionReason,
			MachineRestrictionReason.EVIDENCE_QUARANTINED
		);
	});

	it('keeps a healthy closed machine serving', () => {
		const decision = decide(CLOSED, CLEAN, START);
		assert.equal(decision.trustStage, MachineTrustStage.ESTABLISHED);
		assert.deepEqual(decision.holdReasons, []);
	});
});

describe('machinePlacementWindow', () => {
	it('starts at one and grows by one per success, as TCP slow start does', () => {
		assert.equal(
			machinePlacementWindow(MachineTrustStage.PROBATIONARY, 0, 0),
			1
		);
		assert.equal(
			machinePlacementWindow(MachineTrustStage.ESTABLISHED, 40, 0),
			41
		);
	});

	it('counts only the platform-observed successes since a machine recovered', () => {
		assert.equal(
			machinePlacementWindow(MachineTrustStage.RECOVERING, 40, 2),
			3
		);
	});
});
