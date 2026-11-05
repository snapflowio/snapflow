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
import { NETWORK_PROTOCOL } from '../../constants/networking.constants';
import {
	machineBindingDigest,
	machineTargetPlanDigest,
} from './machine-binding-digest.util';

const machineId = '11111111-1111-4111-8111-111111111111';
const edgeId = '22222222-2222-4222-8222-222222222222';
const bindingId = '33333333-3333-4333-8333-333333333333';

const target = {
	backendId: '44444444-4444-4444-8444-444444444444',
	exposureId: '55555555-5555-4555-8555-555555555555',
	exposureGeneration: 1,
	sandboxId: 'sandbox-one',
	assignmentGeneration: 1,
	placementFencingTokenHash: 'a'.repeat(64),
	protocol: NETWORK_PROTOCOL.HTTP,
	targetHost: 'runtime',
	targetPort: 8080,
};

describe('Machine tunnel control digests', () => {
	it('keeps transport identity stable when only targets change', () => {
		const before = machineBindingDigest(machineId, edgeId, 3, 7);
		const after = machineBindingDigest(machineId, edgeId, 3, 7);

		assert.equal(after, before);
	});

	it('fences target changes independently from the transport', () => {
		const before = machineTargetPlanDigest(bindingId, 7, 11, [target]);
		assert.equal(
			before,
			'3c47bc6d15aa9379ef526d03bf17b4553248a1ca2e84bdcfe3cb2b9906c16d9d'
		);
		const after = machineTargetPlanDigest(bindingId, 7, 12, [
			target,
			{
				...target,
				backendId: '66666666-6666-4666-8666-666666666666',
			},
		]);

		assert.notEqual(after, before);
	});

	it('canonicalizes target ordering', () => {
		const other = {
			...target,
			backendId: '66666666-6666-4666-8666-666666666666',
		};
		assert.equal(
			machineTargetPlanDigest(bindingId, 7, 11, [target, other]),
			machineTargetPlanDigest(bindingId, 7, 11, [other, target])
		);
	});
});
