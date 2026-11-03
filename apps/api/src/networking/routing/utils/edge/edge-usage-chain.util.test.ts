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
import { EDGE_USAGE_CHAIN_POSITION } from '../../constants/edge.constants';
import { edgeUsageChainPosition } from './edge-usage-chain.util';

const FIRST_DIGEST = 'a'.repeat(64);
const SECOND_DIGEST = 'b'.repeat(64);

describe('edgeUsageChainPosition', () => {
	const latest = { usageEpoch: 1, sequence: '4', digest: FIRST_DIGEST };

	it('starts the first epoch without a previous digest', () => {
		assert.equal(
			edgeUsageChainPosition({ usageEpoch: 1, sequence: '1' }, 1, null),
			EDGE_USAGE_CHAIN_POSITION.NEXT
		);
	});

	it('continues the current epoch from the latest checkpoint', () => {
		assert.equal(
			edgeUsageChainPosition(
				{ usageEpoch: 1, sequence: '5', previousDigest: FIRST_DIGEST },
				1,
				latest
			),
			EDGE_USAGE_CHAIN_POSITION.NEXT
		);
	});

	it('restarts the sequence in a new epoch anchored to the last digest', () => {
		assert.equal(
			edgeUsageChainPosition(
				{ usageEpoch: 2, sequence: '1', previousDigest: FIRST_DIGEST },
				2,
				latest
			),
			EDGE_USAGE_CHAIN_POSITION.NEXT
		);
		assert.equal(
			edgeUsageChainPosition({ usageEpoch: 2, sequence: '1' }, 2, latest),
			EDGE_USAGE_CHAIN_POSITION.EPOCH_CLOSED
		);
	});

	it('closes superseded and unknown epochs', () => {
		for (const usageEpoch of [1, 3]) {
			assert.equal(
				edgeUsageChainPosition(
					{ usageEpoch, sequence: '5', previousDigest: FIRST_DIGEST },
					2,
					latest
				),
				EDGE_USAGE_CHAIN_POSITION.EPOCH_CLOSED
			);
		}
	});

	it('closes an epoch whose accepted history the API no longer holds', () => {
		assert.equal(
			edgeUsageChainPosition(
				{ usageEpoch: 1, sequence: '9', previousDigest: SECOND_DIGEST },
				1,
				latest
			),
			EDGE_USAGE_CHAIN_POSITION.EPOCH_CLOSED
		);
		assert.equal(
			edgeUsageChainPosition(
				{ usageEpoch: 1, sequence: '5', previousDigest: SECOND_DIGEST },
				1,
				latest
			),
			EDGE_USAGE_CHAIN_POSITION.EPOCH_CLOSED
		);
	});

	it('rejects a sequence behind the accepted chain', () => {
		assert.equal(
			edgeUsageChainPosition(
				{ usageEpoch: 1, sequence: '2', previousDigest: FIRST_DIGEST },
				1,
				latest
			),
			EDGE_USAGE_CHAIN_POSITION.CONFLICT
		);
	});
});
