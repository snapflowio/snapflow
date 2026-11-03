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
import { BENCHMARK_PROTOCOL } from '../constants/benchmark-policy.constants';
import {
	type ReceiptSpan,
	speedtestLatency,
	speedtestReceiptMessage,
	throughputMbps,
} from './speedtest-receipt.util';

const TOKEN = 'k1.token';
const SPAN: ReceiptSpan = {
	bytes: 1_250_000_000n,
	startedAtMillis: 1_792_065_600_000,
	finishedAtMillis: 1_792_065_613_000,
	measuredBytes: 1_000_000_000n,
	measuredStartedAtMillis: 1_792_065_603_000,
	minRttMicros: 11_250,
	smoothedRttMicros: 24_500,
	rttVarianceMicros: 3_125,
	retransmittedSegments: 17n,
	sentSegments: 905_000n,
};
const PUBLISHED_MESSAGE = [
	'snapflow.speedtest-receipt.v2',
	'k1.token',
	'download',
	'1250000000',
	'1792065600000',
	'1792065613000',
	'1000000000',
	'1792065603000',
	'11250',
	'24500',
	'3125',
	'17',
	'905000',
].join('\n');

function span(
	minRttMicros: number,
	smoothedRttMicros: number,
	rttVarianceMicros: number
): ReceiptSpan {
	return { ...SPAN, minRttMicros, smoothedRttMicros, rttVarianceMicros };
}

describe('speedtestReceiptMessage', () => {
	it('matches the published v2 signing contract', () => {
		assert.equal(
			BENCHMARK_PROTOCOL.SPEEDTEST_RECEIPT_DOMAIN,
			'snapflow.speedtest-receipt.v2'
		);
		assert.equal(
			speedtestReceiptMessage(TOKEN, 'download', SPAN).toString('utf8'),
			PUBLISHED_MESSAGE
		);
	});
});

describe('throughputMbps', () => {
	it('counts only the bytes and time after the Edge ramp', () => {
		assert.equal(throughputMbps([SPAN]), 800);
	});

	it('has no throughput when no bytes were measured', () => {
		assert.equal(
			throughputMbps([
				{
					...SPAN,
					measuredBytes: 0n,
					measuredStartedAtMillis: SPAN.finishedAtMillis,
				},
			]),
			null
		);
		assert.equal(throughputMbps([]), null);
	});
});

describe('speedtestLatency', () => {
	it('takes the lowest idle RTT and the median loaded RTT and jitter', () => {
		assert.deepEqual(
			speedtestLatency([
				span(12_000, 40_000, 2_000),
				span(9_500, 20_000, 8_000),
				span(15_000, 90_000, 5_000),
			]),
			{ minRttMs: 9.5, loadedRttMs: 40, jitterMs: 5 }
		);
	});

	it('averages the middle pair for an even receipt count', () => {
		assert.deepEqual(
			speedtestLatency([
				span(10_000, 30_000, 4_000),
				span(10_500, 50_000, 6_000),
			]),
			{ minRttMs: 10, loadedRttMs: 40, jitterMs: 5 }
		);
	});
});
