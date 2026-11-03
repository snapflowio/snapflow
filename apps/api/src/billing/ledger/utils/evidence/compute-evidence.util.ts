/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { SandboxLease } from '../../../../marketplace/machine/entities/sandbox-lease.entity';
import type { SandboxBillableUsage } from '../../../../usage/metering/entities/sandbox-billable-usage.entity';
import type {
	VerifiedMachineUsageReading,
	VerifiedMachineUsageReceipt,
} from '../../../../usage/metering/utils/evidence/machine-usage-evidence.util';
import { quantityColumns } from '../../../../usage/metering/utils/usage-quantities.util';
import type { BillingLineItem } from '../../entities/billing-line-item.entity';
import {
	BILLING_EVIDENCE_SCHEMA_VERSION,
	type ComputeEvidenceBundle,
	type ComputeEvidenceReceipt,
} from '../../schemas/billing-evidence-bundle.schema';
import type { UsageAttestation } from './usage-attestation.util';

export interface StoredVerifiedReceipt {
	id: string;
	verified: VerifiedMachineUsageReceipt;
}

export function computeEvidenceBundle(
	billable: SandboxBillableUsage,
	line: Pick<BillingLineItem, 'id' | 'contentDigest'>,
	receipts: readonly StoredVerifiedReceipt[],
	attestation: UsageAttestation,
	reconciledAt: Date,
	lease: Pick<SandboxLease, 'priceCardId' | 'markupBasisPoints'>
): ComputeEvidenceBundle {
	return {
		schemaVersion: BILLING_EVIDENCE_SCHEMA_VERSION,
		kind: 'compute',
		lineItemId: line.id,
		lineContentDigest: line.contentDigest,
		createdAt: reconciledAt.toISOString(),
		source: {
			usagePeriodId: billable.usagePeriodId,
			machineId: billable.machineId,
			placementId: billable.placementId,
			sandboxId: billable.sandboxId,
			assignmentGeneration: billable.assignmentGeneration,
			startAt: billable.startAt.toISOString(),
			endAt: billable.endAt.toISOString(),
			durationMillis: billable.durationMillis,
			cpu: billable.cpu,
			memoryGiB: billable.memoryGiB,
			diskGiB: billable.diskGiB,
			gpu: billable.gpu,
			leaseId: billable.leaseId,
			priceCardId: lease.priceCardId,
			markupBasisPoints: lease.markupBasisPoints,
			quantities: {
				vcpuMillis: billable.vcpuMillis,
				memoryGibMillis: billable.memoryGibMillis,
				gpuMillis: billable.gpuMillis,
				runningDiskGibMillis: billable.runningDiskGibMillis,
				stoppedDiskGibMillis: billable.stoppedDiskGibMillis,
			},
			hostMicroUsd: billable.hostChargeMicroUsd,
			markupMicroUsd: billable.markupChargeMicroUsd,
			grossMicroUsd: billable.totalChargeMicroUsd,
		},
		attestation: attestationEvidence(
			billable.policyVersion,
			attestation,
			reconciledAt
		),
		receipts: receipts.map(receiptEvidence),
	};
}

export function attestationEvidence(
	policyVersion: number,
	attestation: UsageAttestation,
	reconciledAt: Date
): ComputeEvidenceBundle['attestation'] {
	return {
		policyVersion,
		computeMillis: attestation.computeMillis.toString(),
		storageMillis: attestation.storageMillis.toString(),
		receiptCount: attestation.receiptCount,
		attestedQuantities: quantityColumns(attestation.attestedQuantities),
		chargedMicroUsd: attestation.charged.grossMicroUsd.toString(),
		chargedHostMicroUsd: attestation.charged.hostMicroUsd.toString(),
		chargedMarkupMicroUsd: attestation.charged.markupMicroUsd.toString(),
		creditedMicroUsd: attestation.creditMicroUsd.toString(),
		reconciledAt: reconciledAt.toISOString(),
	};
}

export function receiptEvidence({
	id,
	verified,
}: StoredVerifiedReceipt): ComputeEvidenceReceipt {
	return {
		id,
		...signedReading(verified),
		intervalStartAt: verified.intervalStartAt.toISOString(),
		intervalStartState: verified.intervalStartState,
		acceptedComputeDeltaMillis: verified.computeMillis.toString(),
		acceptedStorageDeltaMillis: verified.storageMillis.toString(),
		predecessor: verified.predecessor && signedReading(verified.predecessor),
	};
}

function signedReading(reading: VerifiedMachineUsageReading) {
	return {
		signerPublicKey: reading.signerPublicKey,
		payloadDigest: reading.payloadDigest,
		envelope: reading.envelope,
	};
}
