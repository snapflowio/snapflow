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
import { MACHINE_USAGE_RECONCILIATION_DEADLINE_MILLISECONDS } from '../../machine/constants/machine-usage.constants';
import type { MachineUsageReceipt } from '../../machine/entities/machine-usage-receipt.entity';
import {
	signedUsageChain,
	type UsageReadingSpec,
} from '../../machine/testing/signed-usage-readings.fixtures';
import { MachinePriceCard } from '../../marketplace/entities/machine-price-card.entity';
import { SandboxLease } from '../../marketplace/entities/sandbox-lease.entity';
import { priceUsage } from '../../marketplace/utils/pricing.util';
import { RECONCILIATION_SCHEDULE } from '../../usage/constants/usage-accounting.constants';
import type { SandboxBillableUsage } from '../../usage/entities/sandbox-billable-usage.entity';
import { quantitiesFor } from '../../usage/utils/usage-quantities.util';
import { BillingEvidenceStatus } from '../constants/billing.constants';
import { BillingEvidenceBundle } from '../entities/billing-evidence-bundle.entity';
import type {
	BillingEvidenceBundlePayload,
	ComputeEvidenceBundle,
} from '../schemas/billing-evidence-bundle.schema';
import {
	billableWindow,
	computeLine,
	storedReceipts,
	WINDOW_ALLOCATION,
	WINDOW_RATES,
	WINDOW_TERMS,
	windowLease,
} from '../testing/billable-window.fixtures';
import { auditComputeEvidence } from '../utils/evidence/compute-evidence-audit.util';
import type { UsageAttestation } from '../utils/evidence/usage-attestation.util';
import { BillingEvidenceBundleService } from './evidence/billing-evidence-bundle.service';
import { UsageBillingService } from './usage-billing.service';
import { UsageReconciliationService } from './usage-reconciliation.service';

const WINDOW_START = new Date('2026-09-14T12:00:00.000Z');
const WINDOW_MILLIS = 60 * MILLISECONDS_PER_SECOND;
const LEAD_MILLIS = MILLISECONDS_PER_SECOND;
const WINDOW_END = WINDOW_START.getTime() + WINDOW_MILLIS;
const BEFORE_DEADLINE = new Date(WINDOW_END + LEAD_MILLIS);
const AT_DEADLINE = new Date(
	WINDOW_END + MACHINE_USAGE_RECONCILIATION_DEADLINE_MILLISECONDS
);

function at(offsetMillis: number): Date {
	return new Date(WINDOW_START.getTime() + offsetMillis);
}

function ranUntil(stoppedAtMillis: number): UsageReadingSpec[] {
	return [
		{ sampledAt: at(-LEAD_MILLIS), runningMillis: 0 },
		{
			sampledAt: at(stoppedAtMillis),
			runningMillis: LEAD_MILLIS + stoppedAtMillis,
		},
	];
}

function harness(
	row: SandboxBillableUsage,
	receipts: readonly MachineUsageReceipt[],
	now: Date
) {
	const manager = fakeInstance(EntityManager);
	mock.method(
		manager,
		'transactional',
		async (operation: (transaction: EntityManager) => Promise<unknown>) =>
			operation(manager)
	);
	mock.method(manager, 'findOne', async () => row);
	mock.method(manager, 'findOneOrFail', async (entity: unknown) =>
		entity === SandboxLease
			? windowLease().lease
			: Object.assign(new MachinePriceCard(), WINDOW_RATES)
	);
	mock.method(manager, 'execute', async () => [{ now }]);
	mock.method(
		manager,
		'find',
		async (...lookup: [unknown, { id?: { $in: string[] } }]) => {
			const ids = lookup[1].id?.$in;
			return ids
				? receipts.filter((receipt) => ids.includes(receipt.id))
				: receipts;
		}
	);
	const line = computeLine(row);
	const billing = fakeInstance(UsageBillingService);
	mock.method(billing, 'lockLine', async () => line);
	const attestations: UsageAttestation[] = [];
	const settle = mock.method(
		billing,
		'corroborate',
		async (...args: Parameters<UsageBillingService['corroborate']>) => {
			attestations.push(args[4]);
			args[1].evidenceStatus = BillingEvidenceStatus.CORROBORATED;
			return args[1];
		}
	);
	const evidenceBundles = fakeInstance(BillingEvidenceBundleService);
	const payloads: BillingEvidenceBundlePayload[] = [];
	const record = mock.method(
		evidenceBundles,
		'record',
		async (...args: Parameters<BillingEvidenceBundleService['record']>) => {
			payloads.push(args[1]);
			return fakeInstance(BillingEvidenceBundle);
		}
	);
	const service = new UsageReconciliationService(
		manager,
		billing,
		evidenceBundles
	);
	return {
		reconcile: () => service.reconcile(row.id),
		line,
		settle,
		record,
		attestation: (): UsageAttestation => {
			const [attestation] = attestations;
			assert.ok(attestation);
			return attestation;
		},
		bundle: (): ComputeEvidenceBundle => {
			const [payload] = payloads;
			assert.ok(payload?.kind === 'compute');
			return payload;
		},
	};
}

describe('usage evidence reconciliation', () => {
	it('settles a fully attested window at once with evidence an auditor accepts', async () => {
		const row = billableWindow(WINDOW_START, WINDOW_MILLIS);
		const test = harness(
			row,
			storedReceipts(signedUsageChain(ranUntil(WINDOW_MILLIS + LEAD_MILLIS))),
			BEFORE_DEADLINE
		);

		await test.reconcile();

		assert.deepEqual(test.attestation().creditMicroUsd, MicroUsd.ZERO);
		assert.deepEqual(
			auditComputeEvidence(test.line, test.bundle(), windowLease()),
			MicroUsd.parse(row.totalChargeMicroUsd)
		);
	});

	it('waits for late readings while a window is only partly attested', async () => {
		const row = billableWindow(WINDOW_START, WINDOW_MILLIS);
		const test = harness(
			row,
			storedReceipts(signedUsageChain(ranUntil(WINDOW_MILLIS / 2))),
			BEFORE_DEADLINE
		);

		await test.reconcile();

		assert.equal(test.settle.mock.callCount(), 0);
		assert.equal(row.evidenceStatus, BillingEvidenceStatus.PENDING);
		assert.equal(
			row.nextReconcileAt.getTime(),
			BEFORE_DEADLINE.getTime() +
				RECONCILIATION_SCHEDULE.POLL_INTERVAL_MILLISECONDS
		);
	});

	it('settles a partly attested window at the deadline, crediting the rest', async () => {
		const row = billableWindow(WINDOW_START, WINDOW_MILLIS);
		const test = harness(
			row,
			storedReceipts(signedUsageChain(ranUntil(WINDOW_MILLIS / 2))),
			AT_DEADLINE
		);

		await test.reconcile();

		const attestation = test.attestation();
		assert.deepEqual(
			attestation.creditMicroUsd,
			MicroUsd.parse(row.totalChargeMicroUsd).subtract(
				priceUsage(
					WINDOW_TERMS,
					quantitiesFor(WINDOW_ALLOCATION, BigInt(WINDOW_MILLIS / 2), 0n)
				).grossMicroUsd
			)
		);
		assert.deepEqual(
			auditComputeEvidence(test.line, test.bundle(), windowLease()),
			attestation.charged.grossMicroUsd
		);
	});

	it('credits a window without receipts in full at the deadline', async () => {
		const row = billableWindow(WINDOW_START, WINDOW_MILLIS);
		const test = harness(row, [], AT_DEADLINE);

		await test.reconcile();

		assert.deepEqual(
			test.attestation().creditMicroUsd,
			MicroUsd.parse(row.totalChargeMicroUsd)
		);
		assert.deepEqual(test.bundle().receipts, []);
	});

	it('leaves a stored receipt that no longer verifies out of the evidence', async () => {
		const row = billableWindow(WINDOW_START, WINDOW_MILLIS);
		const receipts = storedReceipts(
			signedUsageChain(ranUntil(WINDOW_MILLIS + LEAD_MILLIS))
		);
		const tampered = receipts.map((receipt) =>
			Object.assign(receipt, {
				envelope: { ...receipt.envelope, runningMillis: '1' },
			})
		);
		const test = harness(row, tampered, AT_DEADLINE);

		await test.reconcile();

		assert.deepEqual(test.attestation().charged.grossMicroUsd, MicroUsd.ZERO);
		assert.deepEqual(test.bundle().receipts, []);
	});
});
