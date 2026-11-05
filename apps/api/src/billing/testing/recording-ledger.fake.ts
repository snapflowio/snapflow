/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { mock } from 'node:test';
import { EntityManager } from '@mikro-orm/postgresql';
import { fakeInstance } from '../../common/testing/instance.fake';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { BillingLedgerSide } from '../constants/billing.constants';
import { BillingEvidenceBundle } from '../entities/billing-evidence-bundle.entity';
import { BillingLedgerTransaction } from '../entities/billing-ledger-transaction.entity';
import { BillingLineAdjustment } from '../entities/billing-line-adjustment.entity';
import {
	type BillingLedgerPosting,
	BillingLedgerService,
} from '../services/billing-ledger.service';
import { BillingLineAdjustmentService } from '../services/billing-line-adjustment.service';
import { BillingLineItemService } from '../services/billing-line-item.service';
import { BillingAttestationService } from '../services/evidence/billing-attestation.service';
import {
	type BillingAuditVerdict,
	BillingEvidenceAuditorService,
} from '../services/evidence/billing-evidence-auditor.service';
import { BillingQuarantineService } from '../services/evidence/billing-quarantine.service';
import { UsageBillingService } from '../services/usage-billing.service';
import type { UsageAttestation } from '../utils/evidence/usage-attestation.util';
import {
	billableWindow,
	computeLine,
	windowLease,
} from './billable-window.fixtures';

const RECONCILED_AT = new Date('2026-10-04T12:30:00.000Z');

export class RecordingLedger extends BillingLedgerService {
	readonly postings: BillingLedgerPosting[] = [];

	override async post(
		...args: Parameters<BillingLedgerService['post']>
	): Promise<BillingLedgerTransaction> {
		const posting = args[1];
		this.postings.push(posting);
		return Object.assign(new BillingLedgerTransaction(), {
			sourceType: posting.sourceType,
			sourceReference: posting.sourceReference,
		});
	}
}

class FixedVerdictAuditor extends BillingEvidenceAuditorService {
	constructor(private readonly verdict: BillingAuditVerdict) {
		super();
	}

	override audit(): BillingAuditVerdict {
		return this.verdict;
	}
}

export function attestationService(
	ledger: BillingLedgerService,
	auditor: BillingEvidenceAuditorService
): BillingAttestationService {
	const adjustments = new BillingLineAdjustmentService();
	return new BillingAttestationService(
		ledger,
		adjustments,
		auditor,
		new BillingQuarantineService(adjustments)
	);
}

export async function settleWindow(
	startAt: Date,
	durationMillis: number,
	attestation: (gross: MicroUsd) => UsageAttestation,
	verdict: BillingAuditVerdict = { passed: true }
) {
	const billable = billableWindow(startAt, durationMillis);
	const line = computeLine(billable);
	const gross = MicroUsd.parse(billable.totalChargeMicroUsd);
	const ledger = new RecordingLedger();
	const adjustments: BillingLineAdjustment[] = [];
	const manager = recordingManager(adjustments, RECONCILED_AT);
	const billing = new UsageBillingService(
		new BillingLineItemService(),
		attestationService(ledger, new FixedVerdictAuditor(verdict))
	);
	await billing.corroborate(
		manager,
		billable,
		line,
		new BillingEvidenceBundle(),
		attestation(gross),
		RECONCILED_AT,
		windowLease()
	);
	return { billable, line, gross, postings: ledger.postings, adjustments };
}

function recordingManager(
	adjustments: BillingLineAdjustment[],
	now: Date
): EntityManager {
	const manager = fakeInstance(EntityManager);
	mock.method(manager, 'execute', async () => [{ now }]);
	mock.method(manager, 'find', async () => adjustments);
	mock.method(manager, 'findOne', async () => null);
	mock.method(manager, 'create', (...args: unknown[]) =>
		Object.assign(
			Object.create((args[0] as { prototype: object }).prototype),
			args[1]
		)
	);
	mock.method(manager, 'persist', (...args: unknown[]) => {
		const [row] = args;
		if (row instanceof BillingLineAdjustment) adjustments.push(row);
		return manager;
	});
	return manager;
}

export function accountBalances(
	postings: readonly BillingLedgerPosting[]
): Map<string, MicroUsd> {
	const balances = new Map<string, MicroUsd>();
	for (const posting of postings) {
		for (const entry of posting.entries) {
			const amount = MicroUsd.parse(entry.amount);
			balances.set(
				entry.account.accountCode,
				(balances.get(entry.account.accountCode) ?? MicroUsd.ZERO).add(
					entry.side === BillingLedgerSide.DEBIT ? amount : amount.negate()
				)
			);
		}
	}
	return balances;
}
