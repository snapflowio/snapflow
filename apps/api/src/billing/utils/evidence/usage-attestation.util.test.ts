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
import { MILLISECONDS_PER_SECOND } from '../../../common/constants/time.constants';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import { priceUsage } from '../../../marketplace/utils/pricing.util';
import { MachineUsageRuntimeState } from '../../../sandbox/machine/constants/machine-usage.constants';
import {
	type SignedUsageReceipt,
	signedUsageChain,
	USAGE_ALLOCATION,
	USAGE_MACHINE_ID,
	type UsageReadingSpec,
} from '../../../sandbox/machine/testing/signed-usage-readings.fixtures';
import { UsageMode } from '../../../usage/constants/usage-lifecycle.constants';
import {
	LIFECYCLE_WINDOWS,
	lifecycleReceipts,
} from '../../../usage/testing/lifecycle-receipt.fixtures';
import { verifyMachineUsageReceipt } from '../../../usage/utils/evidence/machine-usage-evidence.util';
import {
	type AllocationUnits,
	allocationColumns,
	allocationUnits,
	intendedQuantities,
	quantitiesFor,
	quantityColumns,
} from '../../../usage/utils/usage-quantities.util';
import { BillingReconciliationReason } from '../../constants/billing.constants';
import { WINDOW_TERMS } from '../../usage/testing/billable-window.fixtures';
import { attestationReason } from './billing-attestation.util';
import {
	type AttestationWindow,
	attestUsageWindow,
} from './usage-attestation.util';

const WINDOW_START = new Date('2026-10-04T12:00:00.000Z');
const WINDOW_MILLIS = 100 * MILLISECONDS_PER_SECOND;
const LEAD_MILLIS = MILLISECONDS_PER_SECOND;
const PERCENT = 100;
const THRESHOLD_COVERAGE_PERCENT = 80;
const BELOW_THRESHOLD_COVERAGE_PERCENT = 79;
const { STOPPED, ERROR } = MachineUsageRuntimeState;

function units(allocation: typeof USAGE_ALLOCATION): AllocationUnits {
	return {
		cpu: allocationUnits(allocation.cpu, 'CPU'),
		memoryGiB: allocationUnits(allocation.memoryGiB, 'memory'),
		diskGiB: allocationUnits(allocation.diskGiB, 'disk'),
		gpu: allocationUnits(allocation.gpu, 'GPU'),
	};
}

function gross(
	allocation: typeof USAGE_ALLOCATION,
	runningMillis: bigint,
	stoppedMillis: bigint
): MicroUsd {
	return priceUsage(
		WINDOW_TERMS,
		quantitiesFor(units(allocation), runningMillis, stoppedMillis)
	).grossMicroUsd;
}

const INTENDED = gross(USAGE_ALLOCATION, BigInt(WINDOW_MILLIS), 0n);

function window(
	allocation: typeof USAGE_ALLOCATION = USAGE_ALLOCATION,
	startAt = WINDOW_START,
	durationMillis = WINDOW_MILLIS,
	mode: UsageMode = UsageMode.FULL
): AttestationWindow {
	const allocated = units(allocation);
	return {
		startAt,
		endAt: new Date(startAt.getTime() + durationMillis),
		durationMillis: durationMillis.toString(),
		...allocationColumns(allocated),
		...quantityColumns(
			intendedQuantities(allocated, mode, BigInt(durationMillis))
		),
	};
}

function at(offsetMillis: number): Date {
	return new Date(WINDOW_START.getTime() + offsetMillis);
}

function verified(chain: readonly SignedUsageReceipt[]) {
	return chain.map((receipt) =>
		verifyMachineUsageReceipt(USAGE_MACHINE_ID, receipt, receipt.predecessor)
	);
}

function attest(readings: readonly UsageReadingSpec[], target = window()) {
	return attestUsageWindow(
		target,
		WINDOW_TERMS,
		verified(signedUsageChain(readings))
	);
}

function ranUntil(stoppedAtMillis: number): UsageReadingSpec[] {
	return [
		{ sampledAt: at(-LEAD_MILLIS), runningMillis: 0 },
		{
			sampledAt: at(stoppedAtMillis),
			runningMillis: LEAD_MILLIS + stoppedAtMillis,
			state: STOPPED,
		},
		{
			sampledAt: at(WINDOW_MILLIS + LEAD_MILLIS),
			runningMillis: LEAD_MILLIS + stoppedAtMillis,
			state: STOPPED,
		},
	];
}

function ranThroughout(): UsageReadingSpec[] {
	return [
		{ sampledAt: at(-LEAD_MILLIS), runningMillis: 0 },
		{
			sampledAt: at(WINDOW_MILLIS + LEAD_MILLIS),
			runningMillis: WINDOW_MILLIS + 2 * LEAD_MILLIS,
		},
	];
}

describe('attestUsageWindow', () => {
	it('charges a fully attested window its intended charge', () => {
		const attestation = attest(ranThroughout());
		assert.deepEqual(attestation.charged.grossMicroUsd, INTENDED);
		assert.deepEqual(attestation.creditMicroUsd, MicroUsd.ZERO);
		assert.equal(attestationReason(attestation), null);
	});

	it('splits the attested charge exactly into host and markup', () => {
		const { charged } = attest(ranThroughout());
		assert.deepEqual(
			charged.hostMicroUsd.add(charged.markupMicroUsd),
			charged.grossMicroUsd
		);
		assert.ok(charged.markupMicroUsd.isPositive());
	});

	it('charges only the attested 80% of compute instead of the whole window', () => {
		const attestedCompute = BigInt(
			(THRESHOLD_COVERAGE_PERCENT * WINDOW_MILLIS) / PERCENT
		);
		const attestation = attest(
			ranUntil((THRESHOLD_COVERAGE_PERCENT * WINDOW_MILLIS) / PERCENT)
		);
		assert.equal(attestation.computeMillis, attestedCompute);
		assert.equal(attestation.storageMillis, BigInt(WINDOW_MILLIS));
		const charged = gross(USAGE_ALLOCATION, attestedCompute, 0n);
		assert.deepEqual(attestation.charged.grossMicroUsd, charged);
		assert.deepEqual(attestation.creditMicroUsd, INTENDED.subtract(charged));
		assert.equal(
			attestationReason(attestation),
			BillingReconciliationReason.PARTIALLY_ATTESTED
		);
	});

	it('still charges the attested 79% rather than releasing the whole window', () => {
		const attestedCompute = BigInt(
			(BELOW_THRESHOLD_COVERAGE_PERCENT * WINDOW_MILLIS) / PERCENT
		);
		const attestation = attest(
			ranUntil((BELOW_THRESHOLD_COVERAGE_PERCENT * WINDOW_MILLIS) / PERCENT)
		);
		assert.deepEqual(
			attestation.charged.grossMicroUsd,
			gross(USAGE_ALLOCATION, attestedCompute, 0n)
		);
	});

	it('credits the whole window when no receipt arrived', () => {
		const attestation = attestUsageWindow(window(), WINDOW_TERMS, []);
		assert.equal(attestation.receiptCount, 0);
		assert.deepEqual(attestation.charged.grossMicroUsd, MicroUsd.ZERO);
		assert.deepEqual(attestation.creditMicroUsd, INTENDED);
		assert.equal(
			attestationReason(attestation),
			BillingReconciliationReason.UNATTESTED
		);
	});

	it('charges nothing for compute after a host-side crash', () => {
		const crashedAt = WINDOW_MILLIS / 4;
		const attestation = attest([
			{ sampledAt: at(-LEAD_MILLIS), runningMillis: 0 },
			{
				sampledAt: at(crashedAt + LEAD_MILLIS),
				runningMillis: LEAD_MILLIS + crashedAt,
				state: ERROR,
			},
			{
				sampledAt: at(WINDOW_MILLIS + LEAD_MILLIS),
				runningMillis: LEAD_MILLIS + crashedAt,
				state: ERROR,
			},
		]);
		assert.equal(attestation.computeMillis, BigInt(crashedAt));
	});

	it('charges nothing for the part of a window after receipts stopped', () => {
		const lastReadingAt = WINDOW_MILLIS / 2;
		const attestation = attest([
			{ sampledAt: at(-LEAD_MILLIS), runningMillis: 0 },
			{
				sampledAt: at(lastReadingAt),
				runningMillis: LEAD_MILLIS + lastReadingAt,
			},
		]);
		assert.equal(attestation.computeMillis, BigInt(lastReadingAt));
		assert.equal(attestation.storageMillis, BigInt(lastReadingAt));
		assert.deepEqual(
			attestation.charged.grossMicroUsd,
			gross(USAGE_ALLOCATION, BigInt(lastReadingAt), 0n)
		);
	});

	it('attests a run whose readings arrived late after lost heartbeats', () => {
		const attestation = attest([
			{ sampledAt: at(-LEAD_MILLIS), runningMillis: 0 },
			{
				sampledAt: at(WINDOW_MILLIS + LEAD_MILLIS),
				runningMillis: WINDOW_MILLIS + 2 * LEAD_MILLIS,
			},
		]);
		assert.deepEqual(attestation.creditMicroUsd, MicroUsd.ZERO);
	});

	it('ignores receipts that metered another allocation', () => {
		const attestation = attest(
			ranThroughout().map((reading) => ({
				...reading,
				allocation: { cpu: USAGE_ALLOCATION.cpu + 1 },
			}))
		);
		assert.equal(attestation.receiptCount, 0);
		assert.deepEqual(attestation.charged.grossMicroUsd, MicroUsd.ZERO);
	});

	it('charges a stopped sandbox its attested disk at the stopped-disk rate', () => {
		const diskOnly = { ...USAGE_ALLOCATION, cpu: 0, memoryGiB: 0 };
		const attestation = attest(
			[
				{ sampledAt: at(-LEAD_MILLIS), runningMillis: 0, state: STOPPED },
				{
					sampledAt: at(WINDOW_MILLIS + LEAD_MILLIS),
					runningMillis: 0,
					state: STOPPED,
				},
			].map((reading) => ({ ...reading, allocation: diskOnly })),
			window(diskOnly, WINDOW_START, WINDOW_MILLIS, UsageMode.DISK)
		);
		const stopped = gross(diskOnly, 0n, BigInt(WINDOW_MILLIS));
		assert.ok(stopped.isPositive());
		assert.ok(!stopped.equals(gross(diskOnly, BigInt(WINDOW_MILLIS), 0n)));
		assert.deepEqual(attestation.charged.grossMicroUsd, stopped);
		assert.deepEqual(attestation.creditMicroUsd, MicroUsd.ZERO);
	});

	it('fully attests the windows of a live run whose API timestamps trail the machine', () => {
		const receipts = verified(lifecycleReceipts());
		for (const lifecycle of Object.values(LIFECYCLE_WINDOWS)) {
			const target = window(
				USAGE_ALLOCATION,
				lifecycle.startAt,
				Number(lifecycle.durationMillis)
			);
			assert.deepEqual(
				attestUsageWindow(target, WINDOW_TERMS, receipts).creditMicroUsd,
				MicroUsd.ZERO
			);
		}
	});
});
