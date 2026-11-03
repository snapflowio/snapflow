/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomUUID } from 'node:crypto';
import { MILLISECONDS_PER_SECOND } from '../../../common/constants/time.constants';
import { addMilliseconds } from '../../../common/utils/time.util';
import { SandboxClass } from '../../../sandbox/instance/enums/sandbox-class.enum';
import {
	signedUsageChain,
	USAGE_MACHINE_ID,
} from '../../../sandbox/machine/testing/signed-usage-readings.fixtures';
import { verifyMachineUsageReceipt } from '../../../usage/metering/utils/evidence/machine-usage-evidence.util';
import {
	billableWindow,
	computeLine,
	WINDOW_TERMS,
	windowLease,
} from '../../usage/testing/billable-window.fixtures';
import {
	BILLING_LINE_SCHEMA_VERSION,
	BillingEvidenceStatus,
} from '../constants/billing.constants';
import { BillingEvidenceBundle } from '../entities/billing-evidence-bundle.entity';
import type { BillingLineItem } from '../entities/billing-line-item.entity';
import type { BillingEvidenceBundlePayload } from '../schemas/billing-evidence-bundle.schema';
import { billingEvidenceRoot } from '../services/evidence/billing-evidence-bundle.service';
import { computeEvidenceBundle } from '../utils/evidence/compute-evidence.util';
import { attestUsageWindow } from '../utils/evidence/usage-attestation.util';
import { billingLineContentDigest } from '../utils/line-item/billing-line-content.util';

const AUDIT_WINDOW_MILLIS = 60 * MILLISECONDS_PER_SECOND;
const LEAD_MILLIS = MILLISECONDS_PER_SECOND;
const FIRST_WINDOW = new Date('2026-10-04T12:00:00.000Z');

export interface AuditedComputeLine {
	line: BillingLineItem;
	bundle: BillingEvidenceBundle;
	payload: BillingEvidenceBundlePayload;
}

export function auditedComputeLine(index: number): AuditedComputeLine {
	const startAt = addMilliseconds(FIRST_WINDOW, index * AUDIT_WINDOW_MILLIS);
	const billable = Object.assign(billableWindow(startAt, AUDIT_WINDOW_MILLIS), {
		usagePeriodId: randomUUID(),
	});
	const line = Object.assign(computeLine(billable), {
		id: randomUUID(),
		schemaVersion: BILLING_LINE_SCHEMA_VERSION,
		beneficiaryReference: billable.hostOrganizationId,
		resourceSku: SandboxClass.LINUX_VM,
		serviceThrough: billable.endAt,
		consumedQuantities: { durationMillis: billable.durationMillis },
		evidenceStatus: BillingEvidenceStatus.PENDING,
	});
	line.contentDigest = billingLineContentDigest(line);
	const chain = signedUsageChain([
		{ sampledAt: addMilliseconds(startAt, -LEAD_MILLIS), runningMillis: 0 },
		{
			sampledAt: billable.endAt,
			runningMillis: LEAD_MILLIS + AUDIT_WINDOW_MILLIS,
		},
	]);
	const receipts = chain.map((receipt) => ({
		id: receipt.id,
		verified: verifyMachineUsageReceipt(
			USAGE_MACHINE_ID,
			receipt,
			receipt.predecessor
		),
	}));
	const payload = computeEvidenceBundle(
		billable,
		line,
		receipts,
		attestUsageWindow(
			billable,
			WINDOW_TERMS,
			receipts.map(({ verified }) => verified)
		),
		billable.endAt,
		windowLease().lease
	);
	return { line, bundle: evidenceBundle(payload), payload };
}

export function evidenceBundle(
	payload: BillingEvidenceBundlePayload
): BillingEvidenceBundle {
	return Object.assign(new BillingEvidenceBundle(), {
		id: randomUUID(),
		lineItemId: payload.lineItemId,
		schemaVersion: payload.schemaVersion,
		kind: payload.kind,
		root: billingEvidenceRoot(payload),
		payload,
		createdAt: new Date(payload.createdAt),
	});
}

export function tamperedReceiptBundle(
	audited: AuditedComputeLine
): BillingEvidenceBundle {
	const payload = structuredClone(audited.payload);
	if (payload.kind !== 'compute') throw new Error('Expected compute evidence');
	const receipt = payload.receipts.at(-1);
	if (!receipt) throw new Error('Expected a receipt');
	receipt.envelope = {
		...receipt.envelope,
		runningMillis: (BigInt(receipt.envelope.runningMillis) * 2n).toString(),
	};
	return evidenceBundle(payload);
}
