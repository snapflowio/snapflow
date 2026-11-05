/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export interface RatedReceiptEvidence {
	id: string;
	payloadDigest: string;
	acceptedInternetEgressDeltaBytes: string;
	acceptedInternetIngressDeltaBytes: string;
	clampedInternetEgressBytes: string;
	hostEgressDeltaBytes: string;
	hostIngressDeltaBytes: string;
}

export interface RatedEdgeEvidence {
	id: string;
	edgeCheckpointId: string;
	edgeCheckpointDigest: string;
	backendId: string;
	bytesIn: string;
	bytesOut: string;
	billable: boolean;
}

export interface UnratedEvidenceRow {
	kind: 'receipt' | 'edge';
	id: string;
	leaseId: string;
	periodStart: Date | string;
}

export interface UnratedPeriod {
	leaseId: string;
	periodStart: Date;
	receiptIds: string[];
	edgeIds: string[];
}

export interface NetworkPeriodBytes {
	edgeEgressBytes: bigint;
	edgeIngressBytes: bigint;
	internetEgressBytes: bigint;
	internetIngressBytes: bigint;
	hostEgressBytes: bigint;
	hostIngressBytes: bigint;
	clampedInternetEgressBytes: bigint;
	billedEgressBytes: bigint;
}
