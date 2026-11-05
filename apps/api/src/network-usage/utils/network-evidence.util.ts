/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { BillingLineItem } from '../../billing/entities/billing-line-item.entity';
import type { PricedLease } from '../../billing/queries/lease-price.query';
import {
	BILLING_EVIDENCE_SCHEMA_VERSION,
	type NetworkEvidenceBundle,
} from '../../billing/schemas/billing-evidence-bundle.schema';
import type { NetworkUsagePeriod } from '../entities/network-usage-period.entity';
import type {
	RatedEdgeEvidence,
	RatedReceiptEvidence,
} from '../types/network-usage.types';

export function networkEvidenceBundle(
	period: NetworkUsagePeriod,
	line: Pick<BillingLineItem, 'id' | 'contentDigest'>,
	pricedLease: PricedLease,
	receipts: readonly RatedReceiptEvidence[],
	edgeSamples: readonly RatedEdgeEvidence[],
	createdAt: Date
): NetworkEvidenceBundle {
	return {
		schemaVersion: BILLING_EVIDENCE_SCHEMA_VERSION,
		kind: 'network',
		lineItemId: line.id,
		lineContentDigest: line.contentDigest,
		createdAt: createdAt.toISOString(),
		source: {
			networkUsagePeriodId: period.id,
			leaseId: period.leaseId,
			priceCardId: pricedLease.lease.priceCardId,
			placementId: period.placementId,
			sandboxId: period.sandboxId,
			machineId: period.machineId,
			assignmentGeneration: period.assignmentGeneration,
			periodStart: period.periodStart.toISOString(),
			periodEnd: period.periodEnd.toISOString(),
			egressRateMicroUsdPerGiB: period.egressRateMicroUsdPerGiB,
			markupBasisPoints: period.markupBasisPoints,
			edgeEgressBytes: period.edgeEgressBytes,
			internetEgressBytes: period.internetEgressBytes,
			billedEgressBytes: period.billedEgressBytes,
			hostMicroUsd: period.hostMicroUsd,
			markupMicroUsd: period.markupMicroUsd,
			grossMicroUsd: period.grossMicroUsd,
		},
		receipts: receipts.map((receipt) => ({
			id: receipt.id,
			payloadDigest: receipt.payloadDigest,
			acceptedInternetEgressDeltaBytes:
				receipt.acceptedInternetEgressDeltaBytes,
		})),
		edgeSamples: edgeSamples
			.filter(({ billable }) => billable)
			.map((sample) => ({
				id: sample.id,
				edgeCheckpointId: sample.edgeCheckpointId,
				edgeCheckpointDigest: sample.edgeCheckpointDigest,
				backendId: sample.backendId,
				bytesOut: sample.bytesOut,
			})),
	};
}
