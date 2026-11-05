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
import { MachineUsageRuntimeState } from '../../sandbox/machine/constants/machine-usage.constants';
import {
	type ReceiptMeterEvidence,
	receiptWindowOverlap,
} from './receipt-window-overlap.util';

const INTERVAL_START = new Date('2026-10-04T19:00:00.000Z');
const INTERVAL_MILLIS = 1_000;
const RUNNING_MILLIS = 400;
const WINDOW_START_OFFSET_MILLIS = 200;
const WINDOW_END_OFFSET_MILLIS = 700;
const WINDOW_MILLIS = WINDOW_END_OFFSET_MILLIS - WINDOW_START_OFFSET_MILLIS;
const LATE_WINDOW_START_OFFSET_MILLIS = 500;

const { STARTED, STOPPED, PAUSED, ERROR, UNKNOWN } = MachineUsageRuntimeState;

function receipt(
	intervalStartState: MachineUsageRuntimeState,
	state: MachineUsageRuntimeState,
	computeMillis: number
): ReceiptMeterEvidence {
	return {
		intervalStartAt: INTERVAL_START,
		intervalStartState,
		reading: { sampledAt: at(INTERVAL_MILLIS), state },
		computeMillis: BigInt(computeMillis),
		storageMillis: BigInt(INTERVAL_MILLIS),
	};
}

function at(offsetMillis: number): Date {
	return new Date(INTERVAL_START.getTime() + offsetMillis);
}

function windowBetween(startOffsetMillis: number, endOffsetMillis: number) {
	return { startAt: at(startOffsetMillis), endAt: at(endOffsetMillis) };
}

const WINDOW = windowBetween(
	WINDOW_START_OFFSET_MILLIS,
	WINDOW_END_OFFSET_MILLIS
);

function evenShare(computeMillis: number): bigint {
	return BigInt((computeMillis * WINDOW_MILLIS) / INTERVAL_MILLIS);
}

describe('receiptWindowOverlap', () => {
	it('places a run the runtime started inside the interval at its end', () => {
		const started = receipt(STOPPED, STARTED, RUNNING_MILLIS);
		const runStart = INTERVAL_MILLIS - RUNNING_MILLIS;
		assert.equal(
			receiptWindowOverlap(started, WINDOW).computeMillis,
			BigInt(WINDOW_END_OFFSET_MILLIS - runStart)
		);
		assert.equal(
			receiptWindowOverlap(started, windowBetween(runStart, INTERVAL_MILLIS))
				.computeMillis,
			BigInt(RUNNING_MILLIS)
		);
	});

	it('places a run that crashed inside the interval at its start', () => {
		const crashed = receipt(STARTED, ERROR, RUNNING_MILLIS);
		assert.equal(
			receiptWindowOverlap(crashed, WINDOW).computeMillis,
			BigInt(RUNNING_MILLIS - WINDOW_START_OFFSET_MILLIS)
		);
		assert.equal(
			receiptWindowOverlap(
				crashed,
				windowBetween(LATE_WINDOW_START_OFFSET_MILLIS, INTERVAL_MILLIS)
			).computeMillis,
			0n
		);
	});

	it('places a run paused inside the interval at its start', () => {
		const paused = receipt(STARTED, PAUSED, RUNNING_MILLIS);
		assert.equal(
			receiptWindowOverlap(paused, windowBetween(0, RUNNING_MILLIS))
				.computeMillis,
			BigInt(RUNNING_MILLIS)
		);
		assert.equal(
			receiptWindowOverlap(
				paused,
				windowBetween(RUNNING_MILLIS, INTERVAL_MILLIS)
			).computeMillis,
			0n
		);
	});

	it('credits a continuously running interval wherever the window lies', () => {
		const running = receipt(STARTED, STARTED, INTERVAL_MILLIS);
		assert.deepEqual(receiptWindowOverlap(running, WINDOW), {
			computeMillis: BigInt(WINDOW_MILLIS),
			storageMillis: BigInt(WINDOW_MILLIS),
		});
	});

	it('attributes running time evenly when neither end of the interval ran', () => {
		const ambiguous = receipt(STOPPED, STOPPED, RUNNING_MILLIS);
		assert.equal(
			receiptWindowOverlap(ambiguous, WINDOW).computeMillis,
			evenShare(RUNNING_MILLIS)
		);
	});

	it('attributes running time evenly when the opening state is unknown', () => {
		const unknown = receipt(UNKNOWN, STARTED, RUNNING_MILLIS);
		assert.equal(
			receiptWindowOverlap(unknown, WINDOW).computeMillis,
			evenShare(RUNNING_MILLIS)
		);
	});

	it('attributes storage across the whole interval whether or not it ran', () => {
		const stopped = receipt(STOPPED, STOPPED, 0);
		assert.deepEqual(receiptWindowOverlap(stopped, WINDOW), {
			computeMillis: 0n,
			storageMillis: BigInt(WINDOW_MILLIS),
		});
	});

	it('attributes nothing to a baseline reading', () => {
		const baseline = {
			...receipt(STARTED, STARTED, 0),
			reading: { sampledAt: INTERVAL_START, state: STARTED },
			storageMillis: 0n,
		};
		assert.deepEqual(receiptWindowOverlap(baseline, WINDOW), {
			computeMillis: 0n,
			storageMillis: 0n,
		});
	});
});
