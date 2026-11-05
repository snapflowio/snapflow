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
import { BillingBeneficiaryKind } from '../../billing/constants/billing.constants';
import {
	BASIS_POINTS_DENOMINATOR,
	RoundingMode,
} from '../../common/constants/money.constants';
import { BasisPoints } from '../../common/values/basis-points.value';
import { MicroUsd } from '../../common/values/micro-usd.value';
import {
	priceUsage,
	usageQuantities,
} from '../../marketplace/utils/pricing.util';
import type { ChargedLine } from '../types/payment-channel.types';
import {
	amountsExceed,
	cumulativeAmounts,
	owedAmounts,
	voucherTotal,
	ZERO_VOUCHER_AMOUNTS,
} from './voucher-amounts.util';

const MARKUP_BASIS_POINTS = 2_500;
const MARKUP = BasisPoints.of(MARKUP_BASIS_POINTS);

function hostLine(gross: bigint, host: bigint, markup: bigint): ChargedLine {
	return {
		beneficiaryKind: BillingBeneficiaryKind.HOST_ORGANIZATION,
		grossMicroUsd: gross.toString(),
		hostMicroUsd: host.toString(),
		markupMicroUsd: markup.toString(),
	};
}

function platformLine(gross: bigint): ChargedLine {
	return {
		beneficiaryKind: BillingBeneficiaryKind.PLATFORM,
		grossMicroUsd: gross.toString(),
		hostMicroUsd: '0',
		markupMicroUsd: '0',
	};
}

describe('owedAmounts', () => {
	it('splits host lines into the host share and the markup fee', () => {
		assert.deepEqual(
			owedAmounts({ lines: [hostLine(125n, 100n, 25n)], accruals: [] }, MARKUP),
			{
				hostMicroUsd: MicroUsd.of(100n),
				feeMicroUsd: MicroUsd.of(25n),
				serviceMicroUsd: MicroUsd.ZERO,
			}
		);
	});

	it('rounds the cumulative fee down and leaves the rounding to service', () => {
		const amounts = owedAmounts(
			{ lines: [hostLine(4n, 3n, 1n), hostLine(4n, 3n, 1n)], accruals: [] },
			MARKUP
		);
		assert.deepEqual(amounts, {
			hostMicroUsd: MicroUsd.of(6n),
			feeMicroUsd: MicroUsd.of(1n),
			serviceMicroUsd: MicroUsd.of(1n),
		});
		assert.deepEqual(voucherTotal(amounts), MicroUsd.of(8n));
	});

	it('charges platform lines and unsplit lines as service', () => {
		assert.deepEqual(
			owedAmounts(
				{
					lines: [
						hostLine(125n, 100n, 25n),
						platformLine(40n),
						hostLine(9n, 0n, 0n),
					],
					accruals: [],
				},
				MARKUP
			),
			{
				hostMicroUsd: MicroUsd.of(100n),
				feeMicroUsd: MicroUsd.of(25n),
				serviceMicroUsd: MicroUsd.of(49n),
			}
		);
	});

	it('adds what open usage periods accrued at the lease price', () => {
		const accrual = priceUsage(
			{
				vcpuHourMicroUsd: 1_000_000n,
				memoryGibHourMicroUsd: 0n,
				gpuHourMicroUsd: 0n,
				diskGibMonthMicroUsd: 0n,
				stoppedDiskGibMonthMicroUsd: 0n,
				egressMicroUsdPerGiB: 0n,
				markupBasisPoints: MARKUP,
			},
			usageQuantities(
				{ cpu: 1, memoryGiB: 0, diskGiB: 0, gpu: 0 },
				1_800_000n,
				0n
			)
		);
		const amounts = owedAmounts(
			{ lines: [hostLine(125n, 100n, 25n)], accruals: [accrual] },
			MARKUP
		);
		assert.deepEqual(
			amounts.hostMicroUsd,
			accrual.hostMicroUsd.add(MicroUsd.of(100n))
		);
		assert.deepEqual(
			voucherTotal(amounts),
			accrual.grossMicroUsd.add(MicroUsd.of(125n))
		);
	});

	it('refuses charges whose markup cannot carry the fee', () => {
		assert.throws(
			() =>
				owedAmounts(
					{ lines: [hostLine(100n, 100n, 0n)], accruals: [] },
					MARKUP
				),
			/do not cover/
		);
	});

	it('keeps every fee increase within the cap the escrow rounds up', () => {
		const hostIncrements = [1n, 3n, 7n, 2n, 11n, 1n, 1n, 997n, 13n];
		const lines: ChargedLine[] = [];
		let previous = ZERO_VOUCHER_AMOUNTS;
		for (const host of hostIncrements) {
			const markup = MARKUP.applyTo(
				MicroUsd.of(host),
				RoundingMode.CEIL
			).toBigInt();
			lines.push(hostLine(host + markup, host, markup));
			const next = cumulativeAmounts(
				owedAmounts({ lines, accruals: [] }, MARKUP),
				previous
			);
			const hostDelta = next.hostMicroUsd
				.subtract(previous.hostMicroUsd)
				.toBigInt();
			const allowedFee =
				(hostDelta * BigInt(MARKUP_BASIS_POINTS) +
					BASIS_POINTS_DENOMINATOR -
					1n) /
				BASIS_POINTS_DENOMINATOR;
			assert.ok(
				next.feeMicroUsd.subtract(previous.feeMicroUsd).toBigInt() <= allowedFee
			);
			previous = next;
		}
	});
});

describe('cumulativeAmounts', () => {
	it('never lowers an amount a previous voucher carried', () => {
		const previous = {
			hostMicroUsd: MicroUsd.of(100n),
			feeMicroUsd: MicroUsd.of(25n),
			serviceMicroUsd: MicroUsd.of(10n),
		};
		const corrected = {
			hostMicroUsd: MicroUsd.of(90n),
			feeMicroUsd: MicroUsd.of(22n),
			serviceMicroUsd: MicroUsd.of(12n),
		};
		const next = cumulativeAmounts(corrected, previous);
		assert.deepEqual(next, {
			hostMicroUsd: MicroUsd.of(100n),
			feeMicroUsd: MicroUsd.of(25n),
			serviceMicroUsd: MicroUsd.of(12n),
		});
		assert.equal(amountsExceed(next, previous), true);
		assert.equal(amountsExceed(previous, next), false);
		assert.equal(amountsExceed(previous, previous), false);
	});
});
