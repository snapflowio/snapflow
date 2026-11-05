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
	anomalousMachines,
	HostTrafficVerdict,
	type MachineEgressRate,
	reconcileHostTraffic,
} from './network-meter-audit.util';

const MEBIBYTE = 1_048_576n;
const EDGE = 1_024n * MEBIBYTE;

describe('edge and host meter reconciliation', () => {
	it('accepts host relay bytes within the header overhead of the Edge count', () => {
		assert.equal(
			reconcileHostTraffic((EDGE * 105n) / 100n, EDGE),
			HostTrafficVerdict.CONSISTENT
		);
	});

	it('flags a host count far above what the Edge served', () => {
		assert.equal(
			reconcileHostTraffic(EDGE * 2n, EDGE),
			HostTrafficVerdict.INFLATED
		);
	});

	it('flags a host count that misses most of the Edge traffic', () => {
		assert.equal(
			reconcileHostTraffic(EDGE / 2n, EDGE),
			HostTrafficVerdict.UNDERCOUNTED
		);
	});

	it('does not judge machines with too little Edge traffic', () => {
		assert.equal(
			reconcileHostTraffic(10n * MEBIBYTE, MEBIBYTE),
			HostTrafficVerdict.INSUFFICIENT
		);
	});
});

function fleet(
	organizationId: string,
	rates: Record<string, number>
): MachineEgressRate[] {
	return Object.entries(rates).map(([machineId, bytesPerHour]) => ({
		organizationId,
		machineId,
		bytesPerHour,
	}));
}

describe('per-machine egress anomalies', () => {
	const normal = { a: 100e6, b: 110e6, c: 95e6, d: 105e6 };

	it('flags a machine that inflates for several customers', () => {
		assert.deepEqual(
			anomalousMachines([
				...fleet('customer-1', { ...normal, cheat: 900e6 }),
				...fleet('customer-2', { ...normal, cheat: 700e6 }),
			]),
			['cheat']
		);
	});

	it('ignores a single customer with one unusual workload', () => {
		assert.deepEqual(
			anomalousMachines(fleet('customer-1', { ...normal, busy: 900e6 })),
			[]
		);
	});

	it('needs enough machines in a fleet to compare', () => {
		assert.deepEqual(
			anomalousMachines([
				...fleet('customer-1', { a: 1e6, cheat: 900e6 }),
				...fleet('customer-2', { a: 1e6, cheat: 900e6 }),
			]),
			[]
		);
	});
});
