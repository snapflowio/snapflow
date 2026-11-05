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
import { MicroUsd } from '../../../common/values/micro-usd.value';
import type { LinePrice } from '../../../marketplace/types/pricing.types';
import {
	priceTerms,
	priceUsage,
	usageQuantities,
} from '../../../marketplace/utils/pricing.util';
import {
	BILLING_LEDGER_PLATFORM_OWNER,
	BillingChargeClass,
	BillingLedgerAccountCode,
	BillingLedgerOwnerKind,
	BillingLedgerSide,
	BillingLedgerSourceType,
} from '../../constants/billing.constants';
import {
	type PostedBillingLine,
	usagePosting,
} from './billing-usage-posting.util';

const COMPUTE_LINE: PostedBillingLine = {
	id: 'line-id',
	chargeClass: BillingChargeClass.COMPUTE,
	customerOrganizationId: 'customer-id',
	hostOrganizationId: 'host-id',
	periodEnd: new Date('2026-10-04T12:00:00.000Z'),
	sandboxId: 'sandbox-id',
	placementId: 'placement-id',
	machineId: 'machine-id',
};

const CHARGED: LinePrice = {
	hostMicroUsd: MicroUsd.of(1_000_000n),
	markupMicroUsd: MicroUsd.of(250_000n),
	grossMicroUsd: MicroUsd.of(1_250_000n),
};

function amounts(line: PostedBillingLine, charged: LinePrice) {
	return usagePosting(line, charged).entries.map((entry) => [
		entry.account.ownerKind,
		entry.account.ownerReference,
		entry.account.accountCode,
		entry.side,
		entry.amount,
	]);
}

function balance(line: PostedBillingLine, charged: LinePrice): bigint {
	return usagePosting(line, charged).entries.reduce(
		(total, entry) =>
			entry.side === BillingLedgerSide.DEBIT
				? total + BigInt(entry.amount)
				: total - BigInt(entry.amount),
		0n
	);
}

describe('usage posting', () => {
	it('credits pending host earnings and the platform markup', () => {
		const posting = usagePosting(COMPUTE_LINE, CHARGED);
		assert.equal(posting.sourceType, BillingLedgerSourceType.LINE_USAGE);
		assert.equal(posting.sourceReference, COMPUTE_LINE.id);
		assert.deepEqual(amounts(COMPUTE_LINE, CHARGED), [
			[
				BillingLedgerOwnerKind.ORGANIZATION,
				'customer-id',
				BillingLedgerAccountCode.CUSTOMER_CREDIT,
				BillingLedgerSide.DEBIT,
				'1250000',
			],
			[
				BillingLedgerOwnerKind.ORGANIZATION,
				'host-id',
				BillingLedgerAccountCode.HOST_EARNINGS_PENDING,
				BillingLedgerSide.CREDIT,
				'1000000',
			],
			[
				BillingLedgerOwnerKind.PLATFORM,
				BILLING_LEDGER_PLATFORM_OWNER,
				BillingLedgerAccountCode.PLATFORM_MARKUP_REVENUE,
				BillingLedgerSide.CREDIT,
				'250000',
			],
		]);
	});

	it('balances for every price the pricing engine produces', () => {
		const terms = priceTerms(
			{
				vcpuHourMicroUsd: '40481',
				memoryGibHourMicroUsd: '4447',
				gpuHourMicroUsd: '0',
				diskGibMonthMicroUsd: '81',
				stoppedDiskGibMonthMicroUsd: '163',
				egressMicroUsdPerGiB: '0',
			},
			2_500
		);
		for (const runningMillis of [1n, 999n, 3_600_000n, 86_400_001n]) {
			const charged = priceUsage(
				terms,
				usageQuantities(
					{ cpu: 3, memoryGiB: 7, diskGiB: 41, gpu: 0 },
					runningMillis,
					runningMillis / 3n
				)
			);
			assert.equal(balance(COMPUTE_LINE, charged), 0n);
		}
	});

	it('refuses a split that does not add up to the charge', () => {
		assert.throws(() =>
			usagePosting(COMPUTE_LINE, {
				...CHARGED,
				markupMicroUsd: MicroUsd.of(1n),
			})
		);
	});

	it('splits network usage between host earnings and markup like compute', () => {
		const network: PostedBillingLine = {
			...COMPUTE_LINE,
			chargeClass: BillingChargeClass.NETWORK,
		};
		const charged = {
			hostMicroUsd: MicroUsd.of(20_000n),
			markupMicroUsd: MicroUsd.of(5_000n),
			grossMicroUsd: MicroUsd.of(25_000n),
		};
		assert.deepEqual(
			amounts(network, charged).map(([, , accountCode, side]) => [
				accountCode,
				side,
			]),
			[
				[BillingLedgerAccountCode.CUSTOMER_CREDIT, BillingLedgerSide.DEBIT],
				[
					BillingLedgerAccountCode.HOST_EARNINGS_PENDING,
					BillingLedgerSide.CREDIT,
				],
				[
					BillingLedgerAccountCode.PLATFORM_MARKUP_REVENUE,
					BillingLedgerSide.CREDIT,
				],
			]
		);
		assert.equal(balance(network, charged), 0n);
	});

	it('refuses a network line without a host', () => {
		assert.throws(() =>
			usagePosting(
				{
					...COMPUTE_LINE,
					chargeClass: BillingChargeClass.NETWORK,
					hostOrganizationId: null,
				},
				{
					hostMicroUsd: MicroUsd.of(1n),
					markupMicroUsd: MicroUsd.ZERO,
					grossMicroUsd: MicroUsd.of(1n),
				}
			)
		);
	});

	it('refuses to post a line with nothing to charge', () => {
		assert.throws(() =>
			usagePosting(COMPUTE_LINE, {
				hostMicroUsd: MicroUsd.ZERO,
				markupMicroUsd: MicroUsd.ZERO,
				grossMicroUsd: MicroUsd.ZERO,
			})
		);
	});
});
