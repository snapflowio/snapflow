/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { EntityManager } from '@mikro-orm/postgresql';
import { MILLISECONDS_PER_SECOND } from '../../common/constants/time.constants';
import { fakeInstance } from '../../common/testing/instance.fake';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { SandboxLease } from '../../marketplace/entities/sandbox-lease.entity';
import type { LinePrice } from '../../marketplace/types/pricing.types';
import { priceUsage } from '../../marketplace/utils/pricing.util';
import { UsageMode } from '../../usage/constants/usage-lifecycle.constants';
import { SandboxUsagePeriod } from '../../usage/entities/sandbox-usage-period.entity';
import { quantitiesFor } from '../../usage/utils/usage-quantities.util';
import {
	BillingAdjustmentReasonCode,
	BillingEvidenceStatus,
	BillingLedgerAccountCode,
	BillingLedgerSide,
	BillingReconciliationReason,
} from '../constants/billing.constants';
import {
	BillingAuditFailure,
	BillingAuditFaultDomain,
} from '../constants/billing-audit.constants';
import {
	WINDOW_ALLOCATION,
	WINDOW_TERMS,
} from '../testing/billable-window.fixtures';
import {
	accountBalances,
	settleWindow,
} from '../testing/recording-ledger.fake';
import type { UsageAttestation } from '../utils/evidence/usage-attestation.util';
import { BillingLineItemService } from './billing-line-item.service';
import { BillingAttestationService } from './evidence/billing-attestation.service';
import { UsageBillingService } from './usage-billing.service';

const WINDOW_START = new Date('2026-10-04T12:00:00.000Z');
const WINDOW_MILLIS = 60 * MILLISECONDS_PER_SECOND;
const ATTESTED_SHARE_NUMERATOR = 3n;
const ATTESTED_SHARE_DENOMINATOR = 4n;
const NOTHING: LinePrice = {
	hostMicroUsd: MicroUsd.ZERO,
	markupMicroUsd: MicroUsd.ZERO,
	grossMicroUsd: MicroUsd.ZERO,
};

function priceFor(runningMillis: bigint): LinePrice {
	return priceUsage(
		WINDOW_TERMS,
		quantitiesFor(WINDOW_ALLOCATION, runningMillis, 0n)
	);
}

const FULL = priceFor(BigInt(WINDOW_MILLIS));
const PARTIAL = priceFor(
	(BigInt(WINDOW_MILLIS) * ATTESTED_SHARE_NUMERATOR) /
		ATTESTED_SHARE_DENOMINATOR
);

function attestation(charged: LinePrice): UsageAttestation {
	return {
		computeMillis: 0n,
		storageMillis: 0n,
		receiptCount: 0,
		attestedQuantities: quantitiesFor(WINDOW_ALLOCATION, 0n, 0n),
		charged,
		creditMicroUsd: FULL.grossMicroUsd.subtract(charged.grossMicroUsd),
	};
}

function createService() {
	const manager = fakeInstance(EntityManager);
	return {
		manager,
		service: new UsageBillingService(
			new BillingLineItemService(),
			Object.create(BillingAttestationService.prototype)
		),
	};
}

describe('usage corroboration posting', () => {
	it('posts the customer charge to pending host earnings and the platform markup', async () => {
		const settled = await settleWindow(WINDOW_START, WINDOW_MILLIS, () =>
			attestation(FULL)
		);
		const balances = accountBalances(settled.postings);
		const host = MicroUsd.parse(settled.line.hostMicroUsd);
		const markup = MicroUsd.parse(settled.line.markupMicroUsd);
		assert.deepEqual(settled.gross, FULL.grossMicroUsd);
		assert.equal(settled.adjustments.length, 0);
		assert.deepEqual(host.add(markup), settled.gross);
		assert.ok(markup.isPositive());
		assert.deepEqual(
			balances.get(BillingLedgerAccountCode.CUSTOMER_CREDIT),
			settled.gross
		);
		assert.deepEqual(
			balances.get(BillingLedgerAccountCode.HOST_EARNINGS_PENDING),
			host.negate()
		);
		assert.deepEqual(
			balances.get(BillingLedgerAccountCode.PLATFORM_MARKUP_REVENUE),
			markup.negate()
		);
		assert.equal(
			settled.billable.evidenceStatus,
			BillingEvidenceStatus.CORROBORATED
		);
		assert.equal(settled.billable.reconciliationReason, null);
	});

	it('charges only the attested part, priced once, and credits the shortfall', async () => {
		const settled = await settleWindow(WINDOW_START, WINDOW_MILLIS, () =>
			attestation(PARTIAL)
		);
		const balances = accountBalances(settled.postings);
		assert.deepEqual(
			settled.adjustments.map((adjustment) => adjustment.reasonCode),
			[BillingAdjustmentReasonCode.USAGE_ATTESTATION_SHORTFALL]
		);
		assert.deepEqual(
			balances.get(BillingLedgerAccountCode.CUSTOMER_CREDIT),
			PARTIAL.grossMicroUsd
		);
		assert.deepEqual(
			balances.get(BillingLedgerAccountCode.HOST_EARNINGS_PENDING),
			PARTIAL.hostMicroUsd.negate()
		);
		assert.deepEqual(
			balances.get(BillingLedgerAccountCode.PLATFORM_MARKUP_REVENUE),
			PARTIAL.markupMicroUsd.negate()
		);
		assert.equal(
			settled.line.reconciliationReason,
			BillingReconciliationReason.PARTIALLY_ATTESTED
		);
	});

	it('posts nothing for a window without attested usage', async () => {
		const settled = await settleWindow(WINDOW_START, WINDOW_MILLIS, () =>
			attestation(NOTHING)
		);
		assert.deepEqual(settled.postings, []);
		assert.equal(
			settled.line.reconciliationReason,
			BillingReconciliationReason.UNATTESTED
		);
	});

	it('quarantines a line whose evidence fails the audit and posts nothing', async () => {
		const settled = await settleWindow(
			WINDOW_START,
			WINDOW_MILLIS,
			() => attestation(FULL),
			{
				passed: false,
				failure: BillingAuditFailure.MACHINE_EVIDENCE_INVALID,
				faultDomain: BillingAuditFaultDomain.MACHINE,
				detail: 'tampered',
			}
		);
		assert.deepEqual(settled.postings, []);
		assert.deepEqual(
			settled.adjustments.map((adjustment) => adjustment.amountMicroUsd),
			[settled.gross.toString()]
		);
		assert.equal(
			settled.line.reconciliationReason,
			BillingReconciliationReason.EVIDENCE_QUARANTINED
		);
		assert.equal(
			settled.line.evidenceStatus,
			BillingEvidenceStatus.CORROBORATED
		);
	});

	it('balances every posting it makes', async () => {
		const settled = await settleWindow(WINDOW_START, WINDOW_MILLIS, () =>
			attestation(PARTIAL)
		);
		assert.equal(settled.postings.length, 1);
		for (const posting of settled.postings) {
			let net = 0n;
			for (const entry of posting.entries) {
				net +=
					entry.side === BillingLedgerSide.DEBIT
						? BigInt(entry.amount)
						: -BigInt(entry.amount);
			}
			assert.equal(net, 0n, posting.sourceType);
		}
	});
});

describe('usage billing finalization', () => {
	function closedPeriod(startAt: Date, endAt: Date): SandboxUsagePeriod {
		return Object.assign(new SandboxUsagePeriod(), {
			id: 'usage-period-id',
			placementId: 'placement-id',
			leaseId: 'lease-id',
			mode: UsageMode.FULL,
			startAt,
			endAt,
			cpu: 1,
			mem: 1,
			disk: 1,
			gpu: 0,
		});
	}

	for (const name of ['zero-duration', 'self-use'] as const) {
		it(`skips ${name} periods that could never be corroborated`, async () => {
			const { manager, service } = createService();
			mock.method(manager, 'execute', async () => []);
			mock.method(manager, 'findOne', async () => null);
			mock.method(manager, 'findOneOrFail', async () =>
				Object.assign(new SandboxLease(), {
					id: 'lease-id',
					priceCardId: null,
					markupBasisPoints: 0,
				})
			);
			const create = mock.method(manager, 'create', () => {
				throw new Error('No billable may be created');
			});
			const startAt = new Date('2026-09-14T12:00:00.000Z');
			const endAt =
				name === 'zero-duration'
					? startAt
					: new Date('2026-09-14T13:00:00.000Z');

			const billable = await service.finalize(
				manager,
				closedPeriod(startAt, endAt)
			);

			assert.equal(billable, null);
			assert.equal(create.mock.callCount(), 0);
		});
	}
});
