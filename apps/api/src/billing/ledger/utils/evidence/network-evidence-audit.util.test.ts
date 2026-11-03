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
import { ratedNetworkPeriod } from '../../../../networking/usage/testing/network-period.fixtures';
import { windowLease } from '../../../usage/testing/billable-window.fixtures';
import { BillingAuditFailure } from '../../constants/billing-audit.constants';
import { BillingEvidenceAuditError } from '../../exceptions/billing-evidence-audit.exception';
import { auditNetworkEvidence } from './network-evidence-audit.util';

function failure(run: () => unknown): BillingAuditFailure {
	try {
		run();
	} catch (error) {
		if (error instanceof BillingEvidenceAuditError) return error.failure;
		throw error;
	}
	throw new Error('Expected the audit to fail');
}

describe('network evidence audit', () => {
	it('attests the gross charge recomputed from receipts and billable Edge samples', () => {
		const { line, payload, period } = ratedNetworkPeriod();
		assert.equal(
			auditNetworkEvidence(line, payload, windowLease()).toString(),
			period.grossMicroUsd
		);
	});

	it('rejects bytes that differ from the signed evidence', () => {
		const { line, payload } = ratedNetworkPeriod();
		const inflated = structuredClone(payload);
		const [receipt] = inflated.receipts;
		if (!receipt) throw new Error('Expected a receipt');
		receipt.acceptedInternetEgressDeltaBytes = (
			BigInt(receipt.acceptedInternetEgressDeltaBytes) + 1n
		).toString();
		assert.equal(
			failure(() => auditNetworkEvidence(line, inflated, windowLease())),
			BillingAuditFailure.CHARGE_EXCEEDS_ATTESTATION
		);
	});

	it('rejects a price that is not the lease card rate plus markup', () => {
		const { line, payload } = ratedNetworkPeriod();
		const overcharged = structuredClone(payload);
		overcharged.source.grossMicroUsd = (
			BigInt(overcharged.source.grossMicroUsd) + 1n
		).toString();
		assert.equal(
			failure(() => auditNetworkEvidence(line, overcharged, windowLease())),
			BillingAuditFailure.PRICE_MISMATCH
		);
	});

	it('rejects evidence priced on another lease', () => {
		const { line, payload } = ratedNetworkPeriod();
		assert.equal(
			failure(() => auditNetworkEvidence(line, payload, null)),
			BillingAuditFailure.EVIDENCE_REFERENCE_MISMATCH
		);
	});
});
