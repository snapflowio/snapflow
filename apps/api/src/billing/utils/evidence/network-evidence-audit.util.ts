/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BasisPoints } from '../../../common/values/basis-points.value';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import { priceTransfer } from '../../../marketplace/utils/pricing.util';
import { BillingLineSourceType } from '../../constants/billing.constants';
import { BillingAuditFailure } from '../../constants/billing-audit.constants';
import type { BillingLineItem } from '../../entities/billing-line-item.entity';
import type { PricedLease } from '../../queries/lease-price.query';
import type { NetworkEvidenceBundle } from '../../schemas/billing-evidence-bundle.schema';
import { assertEvidence } from './evidence-audit.util';

export function auditNetworkEvidence(
	line: BillingLineItem,
	payload: NetworkEvidenceBundle,
	pricedLease: PricedLease | null
): MicroUsd {
	const { source } = payload;
	assertEvidence(
		line.sourceType === BillingLineSourceType.NETWORK_USAGE_PERIOD &&
			line.sourceId === source.networkUsagePeriodId &&
			line.leaseId === source.leaseId &&
			line.machineId === source.machineId &&
			line.placementId === source.placementId &&
			line.sandboxId === source.sandboxId &&
			line.assignmentGeneration === source.assignmentGeneration &&
			line.periodStart.toISOString() === source.periodStart &&
			line.periodEnd.toISOString() === source.periodEnd,
		BillingAuditFailure.EVIDENCE_REFERENCE_MISMATCH,
		'network source differs'
	);
	assertEvidence(
		pricedLease !== null &&
			pricedLease.lease.id === source.leaseId &&
			pricedLease.lease.priceCardId === source.priceCardId &&
			pricedLease.lease.markupBasisPoints === source.markupBasisPoints &&
			pricedLease.terms.egressMicroUsdPerGiB.toString() ===
				source.egressRateMicroUsdPerGiB,
		BillingAuditFailure.EVIDENCE_REFERENCE_MISMATCH,
		'network lease differs'
	);
	auditNetworkBytes(payload);
	auditNetworkPrice(line, payload);
	return MicroUsd.parse(source.grossMicroUsd);
}

function auditNetworkBytes(payload: NetworkEvidenceBundle): void {
	const { source } = payload;
	const receiptIds = new Set(payload.receipts.map(({ id }) => id));
	const sampleIds = new Set(payload.edgeSamples.map(({ id }) => id));
	assertEvidence(
		receiptIds.size === payload.receipts.length &&
			sampleIds.size === payload.edgeSamples.length,
		BillingAuditFailure.EVIDENCE_REFERENCE_MISMATCH,
		'network evidence repeats'
	);
	const internet = payload.receipts.reduce(
		(total, receipt) =>
			total + BigInt(receipt.acceptedInternetEgressDeltaBytes),
		0n
	);
	const edge = payload.edgeSamples.reduce(
		(total, sample) => total + BigInt(sample.bytesOut),
		0n
	);
	assertEvidence(
		internet.toString() === source.internetEgressBytes &&
			edge.toString() === source.edgeEgressBytes &&
			(internet + edge).toString() === source.billedEgressBytes,
		BillingAuditFailure.CHARGE_EXCEEDS_ATTESTATION,
		'network bytes differ from their evidence'
	);
}

function auditNetworkPrice(
	line: BillingLineItem,
	payload: NetworkEvidenceBundle
): void {
	const { source } = payload;
	const price = priceTransfer(
		{
			egressMicroUsdPerGiB: BigInt(source.egressRateMicroUsdPerGiB),
			markupBasisPoints: BasisPoints.of(source.markupBasisPoints, 'Markup'),
		},
		BigInt(source.billedEgressBytes)
	);
	assertEvidence(
		price.hostMicroUsd.toString() === source.hostMicroUsd &&
			price.markupMicroUsd.toString() === source.markupMicroUsd &&
			price.grossMicroUsd.toString() === source.grossMicroUsd &&
			line.grossMicroUsd === source.grossMicroUsd &&
			line.hostMicroUsd === source.hostMicroUsd &&
			line.markupMicroUsd === source.markupMicroUsd &&
			line.quantities === null,
		BillingAuditFailure.PRICE_MISMATCH,
		'network price differs'
	);
}
