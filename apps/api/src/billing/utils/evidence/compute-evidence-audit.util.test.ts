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
import {
	signedUsageChain,
	USAGE_MACHINE_ID,
} from '../../../machine/testing/signed-usage-readings.fixtures';
import { verifyMachineUsageReceipt } from '../../../usage/utils/evidence/machine-usage-evidence.util';
import type { ComputeEvidenceBundle } from '../../schemas/billing-evidence-bundle.schema';
import {
	billableWindow,
	computeLine,
	WINDOW_TERMS,
	windowLease,
} from '../../testing/billable-window.fixtures';
import { computeEvidenceBundle } from './compute-evidence.util';
import { auditComputeEvidence } from './compute-evidence-audit.util';
import { attestUsageWindow } from './usage-attestation.util';

const WINDOW_START = new Date('2026-10-04T12:00:00.000Z');
const WINDOW_MILLIS = 60 * MILLISECONDS_PER_SECOND;
const STEP_MILLIS = 20 * MILLISECONDS_PER_SECOND;
const RECONCILED_AT = new Date('2026-10-04T12:20:00.000Z');

function at(offsetMillis: number): Date {
	return new Date(WINDOW_START.getTime() + offsetMillis);
}

function reconciled() {
	const billable = billableWindow(WINDOW_START, WINDOW_MILLIS);
	const line = computeLine(billable);
	const chain = signedUsageChain([
		{ sampledAt: at(0), runningMillis: 0 },
		{ sampledAt: at(STEP_MILLIS), runningMillis: STEP_MILLIS },
		{ sampledAt: at(2 * STEP_MILLIS), runningMillis: 2 * STEP_MILLIS },
	]);
	const receipts = chain.map((receipt) => ({
		id: receipt.id,
		verified: verifyMachineUsageReceipt(
			USAGE_MACHINE_ID,
			receipt,
			receipt.predecessor
		),
	}));
	const attestation = attestUsageWindow(
		billable,
		WINDOW_TERMS,
		receipts.map(({ verified }) => verified)
	);
	const bundle = computeEvidenceBundle(
		billable,
		line,
		receipts,
		attestation,
		RECONCILED_AT,
		windowLease().lease
	);
	return { line, bundle, charged: attestation.charged.grossMicroUsd };
}

function tamper(
	bundle: ComputeEvidenceBundle,
	change: (copy: ComputeEvidenceBundle) => void
): ComputeEvidenceBundle {
	const copy = structuredClone(bundle);
	change(copy);
	return copy;
}

describe('auditComputeEvidence', () => {
	it('re-derives the settled amount from the signed receipts alone', () => {
		const { line, bundle, charged } = reconciled();
		assert.ok(
			charged.isPositive() &&
				charged.lessThan(MicroUsd.parse(line.grossMicroUsd))
		);
		assert.deepEqual(
			auditComputeEvidence(line, bundle, windowLease()),
			charged
		);
	});

	it('refuses a tampered predecessor', () => {
		const { line, bundle } = reconciled();
		const tampered = tamper(bundle, (copy) => {
			const predecessor = copy.receipts.at(-1)?.predecessor;
			assert.ok(predecessor);
			predecessor.envelope.runningMillis = '0';
		});
		assert.throws(
			() => auditComputeEvidence(line, tampered, windowLease()),
			/compute receipt/
		);
	});

	it('refuses a tampered accepted delta', () => {
		const { line, bundle } = reconciled();
		const tampered = tamper(bundle, (copy) => {
			const receipt = copy.receipts.at(-1);
			assert.ok(receipt);
			receipt.acceptedComputeDeltaMillis = String(
				BigInt(receipt.acceptedComputeDeltaMillis) + 1n
			);
		});
		assert.throws(
			() => auditComputeEvidence(line, tampered, windowLease()),
			/compute receipt derivation differs/
		);
	});

	it('refuses an inflated attestation record', () => {
		const { line, bundle } = reconciled();
		const tampered = tamper(bundle, (copy) => {
			copy.attestation.chargedMicroUsd = line.grossMicroUsd;
			copy.attestation.creditedMicroUsd = '0';
		});
		assert.throws(
			() => auditComputeEvidence(line, tampered, windowLease()),
			/compute attestation differs/
		);
	});

	it('replays the price from the lease card, not from the bundle', () => {
		const { line, bundle } = reconciled();
		const lease = windowLease();
		assert.throws(
			() =>
				auditComputeEvidence(line, bundle, {
					...lease,
					terms: { ...lease.terms, vcpuHourMicroUsd: 1n },
				}),
			/compute price differs/
		);
		assert.throws(
			() =>
				auditComputeEvidence(line, bundle, {
					...lease,
					lease: Object.assign(structuredClone(lease.lease), {
						priceCardId: null,
					}),
				}),
			/compute lease differs/
		);
		assert.throws(
			() => auditComputeEvidence(line, bundle, null),
			/compute lease differs/
		);
	});

	it('refuses a receipt counted twice', () => {
		const { line, bundle } = reconciled();
		const tampered = tamper(bundle, (copy) => {
			const receipt = copy.receipts.at(-1);
			assert.ok(receipt);
			copy.receipts.push(receipt);
		});
		assert.throws(
			() => auditComputeEvidence(line, tampered, windowLease()),
			/compute receipts repeat/
		);
	});
});
