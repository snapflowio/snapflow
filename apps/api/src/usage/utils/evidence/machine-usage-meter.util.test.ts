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
	type MachineNetworkBytes,
	MachineUsageRuntimeState,
} from '../../../sandbox/machine/constants/machine-usage.constants';
import { MachineUsageEvidenceError } from '../../../sandbox/machine/exceptions/machine-usage-evidence.exception';
import {
	type MachineUsageReading,
	meterMachineUsageInterval,
} from './machine-usage-meter.util';

const OPENED_AT = new Date('2026-10-04T16:42:47.900Z');
const GENERATION = '9d0c4c56-3c0b-4a5f-8f0e-0d6f1f3b2a10';
const NEXT_GENERATION = '5b1e7f0a-2c4d-4e6f-8a9b-0c1d2e3f4a5b';
const SUB_SECOND_RUN_MILLIS = 650;
const STOPPED_FOR_MILLIS = 400;
const NO_NETWORK_BYTES: MachineNetworkBytes = {
	internetEgressBytes: 0n,
	internetIngressBytes: 0n,
	hostEgressBytes: 0n,
	hostIngressBytes: 0n,
	tapEgressBytes: 0n,
	tapIngressBytes: 0n,
};

function traffic(
	internetEgressBytes: bigint,
	hostEgressBytes: bigint
): MachineNetworkBytes {
	return {
		...NO_NETWORK_BYTES,
		internetEgressBytes,
		internetIngressBytes: internetEgressBytes / 2n,
		hostEgressBytes,
		tapEgressBytes: internetEgressBytes + hostEgressBytes,
	};
}

function reading(
	offsetMillis: number,
	runningMillis: number,
	overrides: Partial<MachineUsageReading> = {}
): MachineUsageReading {
	return {
		generationId: GENERATION,
		sequence: BigInt(offsetMillis + 1),
		sampledAt: new Date(OPENED_AT.getTime() + offsetMillis),
		state: MachineUsageRuntimeState.STARTED,
		runningMillis: BigInt(runningMillis),
		network: NO_NETWORK_BYTES,
		...overrides,
	};
}

describe('meterMachineUsageInterval', () => {
	it('opens a baseline with the first reading of a placement', () => {
		const opening = reading(0, 0);
		assert.deepEqual(meterMachineUsageInterval(null, opening), {
			intervalStartAt: opening.sampledAt,
			intervalStartState: opening.state,
			computeMillis: 0n,
			storageMillis: 0n,
			networkDeltas: NO_NETWORK_BYTES,
		});
	});

	it('meters network bytes per class as counter differences', () => {
		const opening = reading(0, 0, { network: traffic(1_000n, 50n) });
		const closing = reading(SUB_SECOND_RUN_MILLIS, SUB_SECOND_RUN_MILLIS, {
			network: traffic(5_000n, 80n),
		});
		assert.deepEqual(
			meterMachineUsageInterval(opening, closing).networkDeltas,
			{
				internetEgressBytes: 4_000n,
				internetIngressBytes: 2_000n,
				hostEgressBytes: 30n,
				hostIngressBytes: 0n,
				tapEgressBytes: 4_030n,
				tapIngressBytes: 0n,
			}
		);
	});

	it('counts a new generation from its own zero baseline', () => {
		const opening = reading(0, 0, { network: traffic(9_000n, 0n) });
		const restored = reading(SUB_SECOND_RUN_MILLIS, SUB_SECOND_RUN_MILLIS, {
			generationId: NEXT_GENERATION,
			network: traffic(300n, 0n),
		});
		assert.equal(
			meterMachineUsageInterval(opening, restored).networkDeltas
				.internetEgressBytes,
			300n
		);
	});

	it('rejects a network counter that moves backwards in a generation', () => {
		const opening = reading(0, 0, { network: traffic(1_000n, 0n) });
		const regressed = reading(SUB_SECOND_RUN_MILLIS, SUB_SECOND_RUN_MILLIS, {
			network: traffic(999n, 0n),
		});
		assert.throws(
			() => meterMachineUsageInterval(opening, regressed),
			MachineUsageEvidenceError
		);
	});

	it('meters a sub-second run exactly from its closing reading', () => {
		const opening = reading(0, 0);
		const closing = reading(SUB_SECOND_RUN_MILLIS, SUB_SECOND_RUN_MILLIS);
		assert.deepEqual(meterMachineUsageInterval(opening, closing), {
			intervalStartAt: opening.sampledAt,
			intervalStartState: opening.state,
			computeMillis: BigInt(SUB_SECOND_RUN_MILLIS),
			storageMillis: BigInt(SUB_SECOND_RUN_MILLIS),
			networkDeltas: NO_NETWORK_BYTES,
		});
	});

	it('credits only the running time of an interval the runtime stopped in', () => {
		const opening = reading(0, 0);
		const afterStop = reading(
			SUB_SECOND_RUN_MILLIS + STOPPED_FOR_MILLIS,
			SUB_SECOND_RUN_MILLIS,
			{ state: MachineUsageRuntimeState.STOPPED }
		);
		const interval = meterMachineUsageInterval(opening, afterStop);
		assert.equal(interval.intervalStartState, MachineUsageRuntimeState.STARTED);
		assert.equal(interval.computeMillis, BigInt(SUB_SECOND_RUN_MILLIS));
		assert.equal(
			interval.storageMillis,
			BigInt(SUB_SECOND_RUN_MILLIS + STOPPED_FOR_MILLIS)
		);
	});

	it('opens a new compute baseline when the runtime generation changes', () => {
		const opening = reading(0, 0);
		const restored = reading(SUB_SECOND_RUN_MILLIS, SUB_SECOND_RUN_MILLIS, {
			generationId: NEXT_GENERATION,
		});
		const interval = meterMachineUsageInterval(opening, restored);
		assert.equal(interval.computeMillis, 0n);
		assert.equal(interval.storageMillis, BigInt(SUB_SECOND_RUN_MILLIS));
	});

	it('rejects readings that do not advance the placement meter', () => {
		const previous = reading(SUB_SECOND_RUN_MILLIS, SUB_SECOND_RUN_MILLIS);
		assert.throws(
			() => meterMachineUsageInterval(previous, reading(0, 0)),
			MachineUsageEvidenceError
		);
		assert.throws(
			() =>
				meterMachineUsageInterval(
					previous,
					reading(SUB_SECOND_RUN_MILLIS * 2, SUB_SECOND_RUN_MILLIS - 1)
				),
			MachineUsageEvidenceError
		);
	});

	it('orders readings by sequence rather than by sample time', () => {
		const opening = reading(0, 0);
		const reordered = reading(SUB_SECOND_RUN_MILLIS, SUB_SECOND_RUN_MILLIS, {
			sequence: opening.sequence,
		});
		assert.throws(
			() => meterMachineUsageInterval(opening, reordered),
			MachineUsageEvidenceError
		);
	});

	it('rejects a later reading whose Machine clock stepped backwards', () => {
		const opening = reading(SUB_SECOND_RUN_MILLIS, 0);
		const stepped = reading(0, SUB_SECOND_RUN_MILLIS, {
			sequence: opening.sequence + 1n,
		});
		assert.throws(
			() => meterMachineUsageInterval(opening, stepped),
			MachineUsageEvidenceError
		);
	});
});
