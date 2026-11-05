/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { canonicalJson } from '../../../common/utils/canonical-json.util';
import type { MicroUsd } from '../../../common/values/micro-usd.value';
import { priceUsage } from '../../../marketplace/utils/pricing.util';
import { MachineUsageEvidenceError } from '../../../sandbox/machine/exceptions/machine-usage-evidence.exception';
import {
	type VerifiedMachineUsageReceipt,
	verifyMachineUsageReceipt,
} from '../../../usage/utils/evidence/machine-usage-evidence.util';
import { parseQuantityColumns } from '../../../usage/utils/usage-quantities.util';
import { BillingLineSourceType } from '../../constants/billing.constants';
import { BillingAuditFailure } from '../../constants/billing-audit.constants';
import type { BillingLineItem } from '../../entities/billing-line-item.entity';
import { BillingEvidenceAuditError } from '../../exceptions/billing-evidence-audit.exception';
import type { PricedLease } from '../../queries/lease-price.query';
import type {
	ComputeEvidenceBundle,
	ComputeEvidenceReceipt,
} from '../../schemas/billing-evidence-bundle.schema';
import { attestationEvidence, receiptEvidence } from './compute-evidence.util';
import { assertEvidence } from './evidence-audit.util';
import { attestUsageWindow } from './usage-attestation.util';

export function auditComputeEvidence(
	line: BillingLineItem,
	payload: ComputeEvidenceBundle,
	pricedLease: PricedLease | null
): MicroUsd {
	const { source } = payload;
	assertEvidence(
		line.sourceType === BillingLineSourceType.SANDBOX_USAGE_PERIOD &&
			line.sourceId === source.usagePeriodId &&
			line.machineId === source.machineId &&
			line.placementId === source.placementId &&
			line.sandboxId === source.sandboxId &&
			line.assignmentGeneration === source.assignmentGeneration &&
			line.leaseId === source.leaseId &&
			line.periodStart.toISOString() === source.startAt &&
			line.periodEnd.toISOString() === source.endAt,
		BillingAuditFailure.EVIDENCE_REFERENCE_MISMATCH,
		'compute source differs'
	);
	assertEvidence(
		pricedLease !== null &&
			pricedLease.lease.id === source.leaseId &&
			pricedLease.lease.priceCardId === source.priceCardId &&
			pricedLease.lease.markupBasisPoints === source.markupBasisPoints,
		BillingAuditFailure.EVIDENCE_REFERENCE_MISMATCH,
		'compute lease differs'
	);
	auditComputePrice(line, payload, pricedLease);
	const digests = new Set(
		payload.receipts.map((receipt) => receipt.payloadDigest)
	);
	assertEvidence(
		digests.size === payload.receipts.length,
		BillingAuditFailure.MACHINE_EVIDENCE_INVALID,
		'compute receipts repeat'
	);
	const verified = payload.receipts.map((receipt) =>
		reverifyReceipt(payload, receipt)
	);
	const attestation = attestUsageWindow(
		{
			startAt: new Date(source.startAt),
			endAt: new Date(source.endAt),
			durationMillis: source.durationMillis,
			cpu: source.cpu,
			memoryGiB: source.memoryGiB,
			diskGiB: source.diskGiB,
			gpu: source.gpu,
			...source.quantities,
		},
		pricedLease.terms,
		verified
	);
	assertEvidence(
		canonicalJson(
			attestationEvidence(
				line.sourceVersion,
				attestation,
				new Date(payload.attestation.reconciledAt)
			)
		) === canonicalJson(payload.attestation),
		BillingAuditFailure.ATTESTATION_MISMATCH,
		'compute attestation differs'
	);
	return attestation.charged.grossMicroUsd;
}

function reverifyReceipt(
	payload: ComputeEvidenceBundle,
	receipt: ComputeEvidenceReceipt
): VerifiedMachineUsageReceipt {
	const { source } = payload;
	assertEvidence(
		receipt.envelope.placementId === source.placementId &&
			receipt.envelope.sandboxId === source.sandboxId &&
			receipt.envelope.assignmentGeneration === source.assignmentGeneration,
		BillingAuditFailure.MACHINE_EVIDENCE_INVALID,
		'compute receipt placement differs'
	);
	const verified = verifiedOrFailure(source.machineId, receipt);
	assertEvidence(
		canonicalJson(receiptEvidence({ id: receipt.id, verified })) ===
			canonicalJson(receipt),
		BillingAuditFailure.ATTESTATION_MISMATCH,
		'compute receipt derivation differs'
	);
	return verified;
}

function auditComputePrice(
	line: BillingLineItem,
	payload: ComputeEvidenceBundle,
	pricedLease: PricedLease
): void {
	const { source } = payload;
	const price = priceUsage(
		pricedLease.terms,
		parseQuantityColumns(source.quantities)
	);
	assertEvidence(
		price.hostMicroUsd.toString() === source.hostMicroUsd &&
			price.markupMicroUsd.toString() === source.markupMicroUsd &&
			price.grossMicroUsd.toString() === source.grossMicroUsd &&
			canonicalJson(line.quantities) === canonicalJson(source.quantities) &&
			line.hostMicroUsd === source.hostMicroUsd &&
			line.markupMicroUsd === source.markupMicroUsd &&
			line.grossMicroUsd === source.grossMicroUsd,
		BillingAuditFailure.PRICE_MISMATCH,
		'compute price differs'
	);
}

function verifiedOrFailure(
	machineId: string,
	receipt: ComputeEvidenceReceipt
): VerifiedMachineUsageReceipt {
	try {
		return verifyMachineUsageReceipt(machineId, receipt, receipt.predecessor);
	} catch (error) {
		if (error instanceof MachineUsageEvidenceError) {
			throw new BillingEvidenceAuditError(
				BillingAuditFailure.MACHINE_EVIDENCE_INVALID,
				`compute receipt: ${error.message}`
			);
		}
		throw error;
	}
}
