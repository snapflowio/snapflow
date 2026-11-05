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
	MUTATION_POLICY,
	mutationPolicyFor,
} from '../../idempotency/handlers/mutation-policy.registry';
import { PaymentChannelController } from './payment-channel.controller';

describe('PaymentChannelController mutation policy', () => {
	it('registers voucher submission as naturally idempotent', () => {
		const handler: keyof PaymentChannelController = 'submitVoucher';
		assert.equal(
			typeof PaymentChannelController.prototype[handler],
			'function'
		);
		assert.equal(
			mutationPolicyFor(PaymentChannelController.name, handler),
			MUTATION_POLICY.NATURALLY_IDEMPOTENT
		);
	});

	it('leaves its reads out of the registry', () => {
		for (const handler of [
			'listChannels',
			'getChannel',
			'pendingVouchers',
			'delegation',
		] satisfies (keyof PaymentChannelController)[]) {
			assert.equal(
				mutationPolicyFor(PaymentChannelController.name, handler),
				undefined
			);
		}
	});
});
