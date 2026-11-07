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
import { ConflictException } from '@nestjs/common';
import type { PublicClient } from 'viem';
import { fakeInstance, fakeValue } from '../../common/testing/instance.fake';
import { TypedConfigService } from '../../config/services/typed-config.service';
import { PaymentChannelErrorCode } from '../constants/payment-channel.constants';
import { ESCROW_ADDRESS, HOST_ADDRESS } from '../testing/escrow-log.fixtures';
import { EscrowFeePolicyService } from './escrow-fee-policy.service';

const FEE_CAP_BASIS_POINTS = 2_500;

function policyService(): { service: EscrowFeePolicyService; reads: string[] } {
	const reads: string[] = [];
	const client = fakeValue<PublicClient>({
		readContract: async ({ functionName }: { functionName: string }) => {
			reads.push(functionName);
			return functionName === 'feeCapBps' ? FEE_CAP_BASIS_POINTS : HOST_ADDRESS;
		},
	});
	const config = fakeInstance(TypedConfigService, {
		get: () => ESCROW_ADDRESS,
	});
	return { service: new EscrowFeePolicyService(client, config), reads };
}

describe('EscrowFeePolicyService', () => {
	it('reads the fee cap and recipient once and caches them', async () => {
		const { service, reads } = policyService();
		const [first, second] = await Promise.all([
			service.policy(),
			service.policy(),
		]);
		assert.deepEqual(first, {
			feeCapBasisPoints: FEE_CAP_BASIS_POINTS,
			feeRecipient: HOST_ADDRESS,
		});
		assert.deepEqual(second, first);
		await service.policy();
		assert.deepEqual(reads.sort(), ['feeCapBps', 'feeRecipient']);
	});

	it('admits markups up to the cap and a markup of zero without a read', async () => {
		const { service, reads } = policyService();
		await service.assertMarkupAllowed(0);
		assert.deepEqual(reads, []);
		await service.assertMarkupAllowed(FEE_CAP_BASIS_POINTS);
	});

	it('refuses a markup above the live cap with a clear error', async () => {
		const { service } = policyService();
		await assert.rejects(
			service.assertMarkupAllowed(FEE_CAP_BASIS_POINTS + 1),
			(error: unknown) => {
				assert.ok(error instanceof ConflictException);
				assert.deepEqual(error.getResponse(), {
					code: PaymentChannelErrorCode.MARKUP_ABOVE_FEE_CAP,
					message:
						'The markup of 2501 basis points is above the escrow fee cap of 2500 basis points, so the escrow would refuse to pay it',
					markupBasisPoints: 2_501,
					feeCapBasisPoints: FEE_CAP_BASIS_POINTS,
				});
				return true;
			}
		);
	});
});
