/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomUUID } from 'node:crypto';
import { BillingEvidenceStatus } from '../../../billing/ledger/constants/billing.constants';
import { BillingLineItem } from '../../../billing/ledger/entities/billing-line-item.entity';
import type { NetworkEvidenceBundle } from '../../../billing/ledger/schemas/billing-evidence-bundle.schema';
import { billingLineContentDigest } from '../../../billing/ledger/utils/line-item/billing-line-content.util';
import { networkLineContent } from '../../../billing/ledger/utils/line-item/network-line-content.util';
import {
	WINDOW_TERMS,
	windowLease,
} from '../../../billing/usage/testing/billable-window.fixtures';
import { SHA256_HEX_LENGTH } from '../../../common/constants/digest.constants';
import { priceTransfer } from '../../../marketplace/machine/utils/pricing.util';
import {
	USAGE_MACHINE_ID,
	USAGE_PLACEMENT,
} from '../../../sandbox/machine/testing/signed-usage-readings.fixtures';
import { NetworkUsagePeriod } from '../entities/network-usage-period.entity';
import type {
	RatedEdgeEvidence,
	RatedReceiptEvidence,
} from '../types/network-usage.types';
import { networkEvidenceBundle } from '../utils/network-evidence.util';
import { networkPeriodBytes } from '../utils/network-usage-period.util';

export const NETWORK_PERIOD_START = new Date('2026-10-18T10:00:00.000Z');
const PERIOD_END = new Date('2026-10-18T11:00:00.000Z');
const DIGEST = 'b'.repeat(SHA256_HEX_LENGTH);
const INGRESS_TO_EGRESS_RATIO = 3n;
const HOST_EGRESS_BYTES = 10n;
const GIBIBYTE = 1_073_741_824n;

export function ratedReceipt(
	internetEgressBytes: bigint,
	hostEgressBytes: bigint
): RatedReceiptEvidence {
	return {
		id: randomUUID(),
		payloadDigest: DIGEST,
		acceptedInternetEgressDeltaBytes: internetEgressBytes.toString(),
		acceptedInternetIngressDeltaBytes: (
			internetEgressBytes * INGRESS_TO_EGRESS_RATIO
		).toString(),
		clampedInternetEgressBytes: '0',
		hostEgressDeltaBytes: hostEgressBytes.toString(),
		hostIngressDeltaBytes: '0',
	};
}

export function ratedEdgeSample(
	bytesOut: bigint,
	billable: boolean
): RatedEdgeEvidence {
	return {
		id: randomUUID(),
		edgeCheckpointId: randomUUID(),
		edgeCheckpointDigest: DIGEST,
		backendId: randomUUID(),
		bytesIn: '1000',
		bytesOut: bytesOut.toString(),
		billable,
	};
}

export interface RatedNetworkPeriod {
	period: NetworkUsagePeriod;
	line: BillingLineItem;
	payload: NetworkEvidenceBundle;
}

export function ratedNetworkPeriod(): RatedNetworkPeriod {
	const pricedLease = windowLease();
	const receipts = [
		ratedReceipt(GIBIBYTE, HOST_EGRESS_BYTES),
		ratedReceipt(GIBIBYTE / 2n, 0n),
	];
	const edgeSamples = [
		ratedEdgeSample(GIBIBYTE / 2n, true),
		ratedEdgeSample(GIBIBYTE, false),
	];
	const bytes = networkPeriodBytes(receipts, edgeSamples);
	const price = priceTransfer(WINDOW_TERMS, bytes.billedEgressBytes);
	const period = Object.assign(new NetworkUsagePeriod(), {
		id: randomUUID(),
		leaseId: pricedLease.lease.id,
		placementId: USAGE_PLACEMENT.placementId,
		sandboxId: USAGE_PLACEMENT.sandboxId,
		machineId: USAGE_MACHINE_ID,
		customerOrganizationId: pricedLease.lease.customerOrganizationId,
		hostOrganizationId: pricedLease.lease.hostOrganizationId,
		assignmentGeneration: USAGE_PLACEMENT.assignmentGeneration,
		periodStart: NETWORK_PERIOD_START,
		periodEnd: PERIOD_END,
		edgeEgressBytes: bytes.edgeEgressBytes.toString(),
		edgeIngressBytes: bytes.edgeIngressBytes.toString(),
		internetEgressBytes: bytes.internetEgressBytes.toString(),
		internetIngressBytes: bytes.internetIngressBytes.toString(),
		hostEgressBytes: bytes.hostEgressBytes.toString(),
		hostIngressBytes: bytes.hostIngressBytes.toString(),
		clampedInternetEgressBytes: bytes.clampedInternetEgressBytes.toString(),
		billedEgressBytes: bytes.billedEgressBytes.toString(),
		egressRateMicroUsdPerGiB: WINDOW_TERMS.egressMicroUsdPerGiB.toString(),
		markupBasisPoints: WINDOW_TERMS.markupBasisPoints.toNumber(),
		hostMicroUsd: price.hostMicroUsd.toString(),
		markupMicroUsd: price.markupMicroUsd.toString(),
		grossMicroUsd: price.grossMicroUsd.toString(),
		receiptCount: receipts.length,
		edgeSampleCount: edgeSamples.length,
		createdAt: PERIOD_END,
	});
	const content = networkLineContent(period);
	const line = Object.assign(new BillingLineItem(), {
		...content,
		id: randomUUID(),
		contentDigest: billingLineContentDigest(content),
		evidenceStatus: BillingEvidenceStatus.PENDING,
		reconciliationReason: null,
		reconciledAt: null,
		earningsReleasedAt: null,
		createdAt: PERIOD_END,
	});
	return {
		period,
		line,
		payload: networkEvidenceBundle(
			period,
			line,
			pricedLease,
			receipts,
			edgeSamples,
			PERIOD_END
		),
	};
}
