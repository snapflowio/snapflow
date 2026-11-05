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
import type { MachineNetworkBytes } from '../../constants/machine-usage.constants';
import {
	clampNetworkDeltas,
	linkCapacityBytes,
	networkLinkLimits,
} from './machine-network-clamp.util';

const THIRTY_SECONDS = 30_000n;
const HUNDRED_MEGABITS = 100_000_000n;
const BURST_BYTES = 4n * 1_024n * 1_024n;

function deltas(
	internetEgressBytes: bigint,
	internetIngressBytes: bigint
): MachineNetworkBytes {
	return {
		internetEgressBytes,
		internetIngressBytes,
		hostEgressBytes: 0n,
		hostIngressBytes: 0n,
		tapEgressBytes: internetEgressBytes,
		tapIngressBytes: internetIngressBytes,
	};
}

describe('network link clamp', () => {
	it('allows the measured link rate plus tolerance and one burst', () => {
		assert.equal(
			linkCapacityBytes(HUNDRED_MEGABITS, THIRTY_SECONDS),
			412_500_000n + BURST_BYTES
		);
	});

	it('takes the slowest of the uplink and the sandbox limits for egress', () => {
		assert.deepEqual(
			networkLinkLimits({ networkUplinkMbps: 100, networkDownlinkMbps: 500 }, [
				10_000_000,
				null,
			]),
			{ egressBitsPerSecond: 10_000_000n, ingressBitsPerSecond: 500_000_000n }
		);
		assert.deepEqual(networkLinkLimits(null, [null, null]), {
			egressBitsPerSecond: null,
			ingressBitsPerSecond: null,
		});
	});

	it('accepts physically possible deltas unchanged', () => {
		assert.deepEqual(
			clampNetworkDeltas(deltas(1_000n, 2_000n), THIRTY_SECONDS, {
				egressBitsPerSecond: HUNDRED_MEGABITS,
				ingressBitsPerSecond: HUNDRED_MEGABITS,
			}),
			{
				acceptedInternetEgressBytes: 1_000n,
				acceptedInternetIngressBytes: 2_000n,
				clampedInternetEgressBytes: 0n,
				clampedInternetIngressBytes: 0n,
			}
		);
	});

	it('clamps an inflated delta to the link capacity and records the excess', () => {
		const capacity = linkCapacityBytes(HUNDRED_MEGABITS, THIRTY_SECONDS);
		const clamped = clampNetworkDeltas(
			deltas(capacity * 3n, 0n),
			THIRTY_SECONDS,
			{ egressBitsPerSecond: HUNDRED_MEGABITS, ingressBitsPerSecond: null }
		);
		assert.equal(clamped.acceptedInternetEgressBytes, capacity);
		assert.equal(clamped.clampedInternetEgressBytes, capacity * 2n);
	});

	it('leaves deltas unclamped when no link speed is known', () => {
		assert.equal(
			clampNetworkDeltas(deltas(10n ** 15n, 0n), THIRTY_SECONDS, {
				egressBitsPerSecond: null,
				ingressBitsPerSecond: null,
			}).acceptedInternetEgressBytes,
			10n ** 15n
		);
	});
});
