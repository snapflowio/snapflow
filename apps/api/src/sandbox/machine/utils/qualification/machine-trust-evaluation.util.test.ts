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
	MINIMUM_CONFIDENT_SAMPLES,
} from '../../../../billing/constants/machine-trust.constants';
import {
	type MachineAttestationMass,
	type MachineOutcomeMass,
	type MachineTrustEvidence,
	machineTrustTrip,
	scoreMachineTrust,
} from './machine-trust-evaluation.util';

const NO_OUTCOMES: MachineOutcomeMass = {
	successful: 0,
	machineFailures: 0,
	unattributedFailures: 0,
};
const NO_ATTESTATION: MachineAttestationMass = {
	windowMass: 0,
	intendedMicroUsd: 0,
	unattestedMicroUsd: 0,
};
const INTENDED_MICRO_USD = 1_000_000;
const PERCENT = 100;
const NO_FRAUD = 0;
const NO_PEERS = null;
const FAILING_FLEET = 0.25;

function evidence(
	outcomes: Partial<MachineOutcomeMass>,
	attestation: Partial<MachineAttestationMass> = {}
): MachineTrustEvidence {
	return {
		outcomes: { ...NO_OUTCOMES, ...outcomes },
		attestation: { ...NO_ATTESTATION, ...attestation },
	};
}

function attested(sharePercent: number, windowMass: number) {
	return {
		windowMass,
		intendedMicroUsd: INTENDED_MICRO_USD,
		unattestedMicroUsd:
			(INTENDED_MICRO_USD * (PERCENT - sharePercent)) / PERCENT,
	};
}

function trips(value: MachineTrustEvidence): boolean {
	return machineTrustTrip(value, NO_FRAUD, NO_PEERS) !== null;
}

describe('machineTrustTrip', () => {
	it('never trips on fewer outcomes than can certify a majority', () => {
		assert.equal(MINIMUM_CONFIDENT_SAMPLES, 3);
		const below = MINIMUM_CONFIDENT_SAMPLES - 1;
		assert.equal(trips(evidence({ machineFailures: below })), false);
	});

	it('judges a machine against its peers when the whole fleet fails', () => {
		const likeThePeers = evidence({ machineFailures: 20, successful: 80 });
		assert.equal(trips(likeThePeers), true);
		assert.equal(machineTrustTrip(likeThePeers, NO_FRAUD, FAILING_FLEET), null);
		assert.equal(
			machineTrustTrip(
				evidence({ machineFailures: 60, successful: 40 }),
				NO_FRAUD,
				FAILING_FLEET
			),
			MachineRestrictionReason.RELIABILITY_DEGRADED
		);
	});

	it('never trips a machine that meets the objective, however good its peers', () => {
		const flawlessFleet = 0;
		assert.equal(
			machineTrustTrip(
				evidence({ machineFailures: 4, successful: 96 }),
				NO_FRAUD,
				flawlessFleet
			),
			null
		);
	});

	it('trips a machine that fails everything as soon as the sample counts', () => {
		assert.equal(trips(evidence({ machineFailures: 3 })), true);
		assert.equal(trips(evidence({ machineFailures: 4 })), true);
	});

	it('trips once confident the failure rate exceeds the tolerable rate', () => {
		assert.equal(
			trips(evidence({ machineFailures: 10, successful: 90 })),
			true
		);
		assert.equal(trips(evidence({ machineFailures: 6, successful: 44 })), true);
		assert.equal(
			trips(evidence({ machineFailures: 4, successful: 46 })),
			false
		);
		assert.equal(
			trips(evidence({ machineFailures: 5, successful: 95 })),
			false
		);
		assert.equal(
			trips(evidence({ machineFailures: 10, successful: 1_000 })),
			false
		);
	});

	it('weighs an unattributed failure as half a machine failure', () => {
		assert.deepEqual(
			scoreMachineTrust(evidence({ unattributedFailures: 8, successful: 40 })),
			scoreMachineTrust(evidence({ machineFailures: 4, successful: 40 }))
		);
	});

	it('lets decayed evidence matter less than fresh evidence', () => {
		assert.equal(trips(evidence({ machineFailures: 6, successful: 10 })), true);
		assert.equal(
			trips(evidence({ machineFailures: 1.5, successful: 10 })),
			false
		);
	});

	it('trips on an attested compute share below the floor once enough windows reconciled', () => {
		const healthy = { successful: 50 };
		assert.equal(trips(evidence(healthy, attested(95, 20))), false);
		assert.equal(
			machineTrustTrip(evidence(healthy, attested(85, 20)), NO_FRAUD, NO_PEERS),
			MachineRestrictionReason.USAGE_ATTESTATION_INSUFFICIENT
		);
		const fewWindows = MACHINE_TRUST_POLICY.minimumAttestationWindowMass - 1;
		assert.equal(trips(evidence(healthy, attested(50, fewWindows))), false);
	});

	it('restricts on one proven evidence fraud whatever the success count', () => {
		assert.equal(
			machineTrustTrip(evidence({ successful: 10_000 }), 1, NO_PEERS),
			MachineRestrictionReason.EVIDENCE_QUARANTINED
		);
	});

	it('names reliability when the failure rate trips', () => {
		assert.equal(
			machineTrustTrip(evidence({ machineFailures: 5 }), NO_FRAUD, NO_PEERS),
			MachineRestrictionReason.RELIABILITY_DEGRADED
		);
	});
});

describe('scoreMachineTrust', () => {
	it('ranks small samples conservatively', () => {
		const few = scoreMachineTrust(evidence({ successful: 3 }));
		const many = scoreMachineTrust(evidence({ successful: 300 }));
		assert.ok(few.reliabilityBasisPoints < many.reliabilityBasisPoints);
	});
});
