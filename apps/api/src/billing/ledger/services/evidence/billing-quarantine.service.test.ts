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
import { windowLease } from '../../../usage/testing/billable-window.fixtures';
import {
	accountBalances,
	attestationService,
	RecordingLedger,
} from '../../../usage/testing/recording-ledger.fake';
import {
	BillingAdjustmentReasonCode,
	BillingEvidenceStatus,
	BillingLedgerAccountCode,
	BillingReconciliationReason,
} from '../../constants/billing.constants';
import {
	BILLING_AUDIT_FAULT_DOMAIN,
	BillingAuditFailure,
	BillingAuditFaultDomain,
} from '../../constants/billing-audit.constants';
import { BillingLineAdjustment } from '../../entities/billing-line-adjustment.entity';
import type { BillingLineItem } from '../../entities/billing-line-item.entity';
import { BillingLineQuarantine } from '../../entities/billing-line-quarantine.entity';
import {
	auditedComputeLine,
	tamperedReceiptBundle,
} from '../../testing/billing-audit.fixtures';
import { InMemoryEntityManager } from '../../testing/in-memory-entity-manager.fake';
import type { AttestedCharge } from '../../utils/evidence/billing-attestation.util';
import { BillingLineAdjustmentService } from '../billing-line-adjustment.service';
import {
	BillingEvidenceAuditorService,
	type FailedBillingAudit,
} from './billing-evidence-auditor.service';
import { BillingQuarantineService } from './billing-quarantine.service';

const RECONCILED_AT = new Date('2026-10-04T13:00:00.000Z');
const SPOT_CHECK_FAILURE: FailedBillingAudit = {
	passed: false,
	failure: BillingAuditFailure.MACHINE_VERIFICATION_FAILED,
	faultDomain:
		BILLING_AUDIT_FAULT_DOMAIN[BillingAuditFailure.MACHINE_VERIFICATION_FAILED],
	detail: 'The machine failed a verification spot check',
};
function fullAttestation(line: BillingLineItem): AttestedCharge {
	return {
		charged: {
			hostMicroUsd: MicroUsd.parse(line.hostMicroUsd),
			markupMicroUsd: MicroUsd.parse(line.markupMicroUsd),
			grossMicroUsd: MicroUsd.parse(line.grossMicroUsd),
		},
		creditMicroUsd: MicroUsd.ZERO,
	};
}

function scenario() {
	const store = new InMemoryEntityManager(RECONCILED_AT);
	const ledger = new RecordingLedger();
	const service = attestationService(
		ledger,
		new BillingEvidenceAuditorService()
	);
	return { store, ledger, service };
}

describe('billing evidence quarantine', () => {
	it('posts a line whose evidence passes the audit', async () => {
		const { store, ledger, service } = scenario();
		const valid = auditedComputeLine(0);

		await service.corroborate(
			store.manager,
			valid.line,
			valid.bundle,
			fullAttestation(valid.line),
			RECONCILED_AT,
			windowLease()
		);

		assert.equal(store.of(BillingLineQuarantine).length, 0);
		assert.equal(valid.line.evidenceStatus, BillingEvidenceStatus.CORROBORATED);
		assert.deepEqual(
			accountBalances(ledger.postings).get(
				BillingLedgerAccountCode.CUSTOMER_CREDIT
			),
			MicroUsd.parse(valid.line.grossMicroUsd)
		);
	});

	it('quarantines a tampered line, credits it in full and posts nothing', async () => {
		const { store, ledger, service } = scenario();
		const tampered = auditedComputeLine(1);

		await service.corroborate(
			store.manager,
			tampered.line,
			tamperedReceiptBundle(tampered),
			fullAttestation(tampered.line),
			RECONCILED_AT,
			windowLease()
		);

		const [record] = store.of(BillingLineQuarantine);
		assert.equal(record?.lineItemId, tampered.line.id);
		assert.equal(
			record?.failureCode,
			BillingAuditFailure.MACHINE_EVIDENCE_INVALID
		);
		assert.equal(record?.faultDomain, BillingAuditFaultDomain.MACHINE);
		assert.equal(record?.machineId, tampered.line.machineId);
		const [credit] = store.of(BillingLineAdjustment);
		assert.equal(
			credit?.reasonCode,
			BillingAdjustmentReasonCode.EVIDENCE_QUARANTINED
		);
		assert.deepEqual(credit?.amountMicroUsd, tampered.line.grossMicroUsd);
		assert.equal(
			tampered.line.reconciliationReason,
			BillingReconciliationReason.EVIDENCE_QUARANTINED
		);
		assert.deepEqual(ledger.postings, []);
	});

	it('caps the attestation shortfall at what a spot-check quarantine left to charge', async () => {
		const { store, ledger, service } = scenario();
		const spotChecked = auditedComputeLine(3);
		const adjustments = new BillingLineAdjustmentService();
		await new BillingQuarantineService(adjustments).quarantine(
			store.manager,
			spotChecked.line,
			null,
			SPOT_CHECK_FAILURE,
			await adjustments.effectiveCharge(store.manager, spotChecked.line),
			RECONCILED_AT
		);
		const gross = MicroUsd.parse(spotChecked.line.grossMicroUsd);

		await service.corroborate(
			store.manager,
			spotChecked.line,
			spotChecked.bundle,
			{
				...fullAttestation(spotChecked.line),
				creditMicroUsd: gross,
			},
			RECONCILED_AT,
			windowLease()
		);

		assert.deepEqual(
			store.of(BillingLineAdjustment).map((credit) => credit.reasonCode),
			[BillingAdjustmentReasonCode.EVIDENCE_QUARANTINED]
		);
		assert.equal(
			spotChecked.line.evidenceStatus,
			BillingEvidenceStatus.CORROBORATED
		);
		assert.deepEqual(ledger.postings, []);
	});

	it('refuses to corroborate a line twice', async () => {
		const { store, service } = scenario();
		const valid = auditedComputeLine(2);
		await service.corroborate(
			store.manager,
			valid.line,
			valid.bundle,
			fullAttestation(valid.line),
			RECONCILED_AT,
			windowLease()
		);

		await assert.rejects(
			service.corroborate(
				store.manager,
				valid.line,
				valid.bundle,
				fullAttestation(valid.line),
				RECONCILED_AT,
				windowLease()
			)
		);
	});
});
