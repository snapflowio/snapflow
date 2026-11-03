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
import { MicroUsd } from '../../../../common/values/micro-usd.value';
import { MachineTrustStage } from '../../constants/machine-trust.constants';
import { evaluateBillingCapacity } from '../../utils/billing-capacity.util';
import { machineExposureCeiling } from './placement-billing-capacity.service';

const CEILINGS = {
	exposureCeilingProbationaryCents: 1_000,
	exposureCeilingEstablishedCents: 10_000,
};
const MICRO_USD_PER_CENT = 10_000n;

describe('machine exposure ceilings from settings', () => {
	it('caps an established machine at the established ceiling', () => {
		assert.deepEqual(
			machineExposureCeiling(CEILINGS, MachineTrustStage.ESTABLISHED),
			MicroUsd.of(10_000n * MICRO_USD_PER_CENT)
		);
	});

	it('caps every other trust stage at the probationary ceiling', () => {
		for (const stage of [
			MachineTrustStage.PROBATIONARY,
			MachineTrustStage.RECOVERING,
			MachineTrustStage.RESTRICTED,
		]) {
			assert.deepEqual(
				machineExposureCeiling(CEILINGS, stage),
				MicroUsd.of(1_000n * MICRO_USD_PER_CENT)
			);
		}
	});

	it('refuses a candidate whose reservation would cross the machine ceiling', () => {
		const ceiling = machineExposureCeiling(
			CEILINGS,
			MachineTrustStage.PROBATIONARY
		);
		const capacity = (requestedMicroUsd: MicroUsd) =>
			evaluateBillingCapacity({
				creditBalanceMicroUsd: ceiling.multiply(10n),
				unpostedChargesMicroUsd: MicroUsd.ZERO,
				reservedUsageMicroUsd: MicroUsd.ZERO,
				requestedMicroUsd,
				monthSpendMicroUsd: MicroUsd.ZERO,
				monthlyLimitMicroUsd: null,
				networkMonthSpendMicroUsd: MicroUsd.ZERO,
				networkRequestedMicroUsd: MicroUsd.ZERO,
				networkLimitMicroUsd: null,
				machineExposureMicroUsd: ceiling.subtract(MicroUsd.of(100n)),
				machineExposureLimitMicroUsd: ceiling,
				hostExposureMicroUsd: MicroUsd.ZERO,
				hostExposureLimitMicroUsd: ceiling.multiply(10n),
			}).allowed;
		assert.equal(capacity(MicroUsd.of(100n)), true);
		assert.equal(capacity(MicroUsd.of(101n)), false);
	});
});
