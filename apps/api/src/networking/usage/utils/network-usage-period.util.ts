/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { parseDatabaseTimestamp } from '../../../infra/database/utils/database-time.util';
import type {
	NetworkPeriodBytes,
	RatedEdgeEvidence,
	RatedReceiptEvidence,
	UnratedEvidenceRow,
	UnratedPeriod,
} from '../types/network-usage.types';

const PERIOD_KEY_SEPARATOR = '|';

export function closedPeriodCutoff(
	now: Date,
	settleMilliseconds: number,
	periodMilliseconds: number
): Date {
	const settled = now.getTime() - settleMilliseconds;
	return new Date(settled - (settled % periodMilliseconds));
}

// Rows arrive ordered by period and lease, so when a batch is full only its
// last group can continue in the next batch; it is left for that batch unless
// it is the only group, which then is rated in parts.
export function groupUnratedEvidence(
	rows: readonly UnratedEvidenceRow[],
	batchSize: number
): UnratedPeriod[] {
	const periods = new Map<string, UnratedPeriod>();
	for (const row of rows) {
		const periodStart = parseDatabaseTimestamp(row.periodStart);
		const key = `${row.leaseId}${PERIOD_KEY_SEPARATOR}${periodStart.toISOString()}`;
		const period = periods.get(key) ?? {
			leaseId: row.leaseId,
			periodStart,
			receiptIds: [],
			edgeIds: [],
		};
		(row.kind === 'receipt' ? period.receiptIds : period.edgeIds).push(row.id);
		periods.set(key, period);
	}
	const grouped = [...periods.values()];
	return rows.length >= batchSize && grouped.length > 1
		? grouped.slice(0, -1)
		: grouped;
}

export function networkPeriodBytes(
	receipts: readonly RatedReceiptEvidence[],
	edgeSamples: readonly RatedEdgeEvidence[]
): NetworkPeriodBytes {
	const billable = edgeSamples.filter(({ billable }) => billable);
	const edgeEgressBytes = sum(billable.map(({ bytesOut }) => bytesOut));
	const internetEgressBytes = sum(
		receipts.map(
			({ acceptedInternetEgressDeltaBytes }) => acceptedInternetEgressDeltaBytes
		)
	);
	return {
		edgeEgressBytes,
		edgeIngressBytes: sum(billable.map(({ bytesIn }) => bytesIn)),
		internetEgressBytes,
		internetIngressBytes: sum(
			receipts.map(
				({ acceptedInternetIngressDeltaBytes }) =>
					acceptedInternetIngressDeltaBytes
			)
		),
		hostEgressBytes: sum(
			receipts.map(({ hostEgressDeltaBytes }) => hostEgressDeltaBytes)
		),
		hostIngressBytes: sum(
			receipts.map(({ hostIngressDeltaBytes }) => hostIngressDeltaBytes)
		),
		clampedInternetEgressBytes: sum(
			receipts.map(
				({ clampedInternetEgressBytes }) => clampedInternetEgressBytes
			)
		),
		billedEgressBytes: edgeEgressBytes + internetEgressBytes,
	};
}

function sum(values: readonly string[]): bigint {
	return values.reduce((total, value) => total + BigInt(value), 0n);
}
