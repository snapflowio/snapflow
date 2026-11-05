/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	BillingEvidenceStatus,
	BillingLineSourceType,
} from '../constants/billing.constants';

export interface EvidenceRetentionPredicate {
	where: string;
	bindings: unknown[];
	orderBy?: string;
}

const AUDIT_WINDOW_START_SQL = `transaction_timestamp() - (? * interval '1 day')`;

const OPEN_LINE_SQL = `(line."evidenceStatus" = '${BillingEvidenceStatus.PENDING}'
	OR line."reconciledAt" >= ${AUDIT_WINDOW_START_SQL}
	OR EXISTS (
		SELECT 1 FROM billing_line_quarantine quarantine
		WHERE quarantine."lineItemId" = line.id
	))`;

export function postedEvidenceBundles(
	retentionDays: number
): EvidenceRetentionPredicate {
	return {
		where: `target."createdAt" < ${AUDIT_WINDOW_START_SQL}
			AND NOT EXISTS (
				SELECT 1 FROM billing_line_item line
				WHERE line.id = target."lineItemId" AND ${OPEN_LINE_SQL}
			)`,
		bindings: [retentionDays, retentionDays],
	};
}

export function ratedNetworkUsage(
	retentionDays: number
): EvidenceRetentionPredicate {
	return {
		where: `target."createdAt" < ${AUDIT_WINDOW_START_SQL}
			AND target."periodId" IS NOT NULL
			AND NOT EXISTS (
				SELECT 1 FROM billing_line_item line
				WHERE line."sourceType" = ? AND line."sourceId" = target."periodId"
					AND ${OPEN_LINE_SQL}
			)`,
		bindings: [
			retentionDays,
			BillingLineSourceType.NETWORK_USAGE_PERIOD,
			retentionDays,
		],
	};
}

export function supersededEdgeCheckpoints(
	retentionDays: number
): EvidenceRetentionPredicate {
	return {
		where: `target."intervalEndedAt" < ${AUDIT_WINDOW_START_SQL}
			AND NOT EXISTS (
				SELECT 1 FROM exposure_network_usage metered
				WHERE metered."edgeCheckpointId" = target.id
			)
			AND EXISTS (
				SELECT 1 FROM edge_usage_checkpoint newer
				WHERE newer."edgeId" = target."edgeId"
					AND (newer."usageEpoch", newer.sequence) > (target."usageEpoch", target.sequence)
			)`,
		bindings: [retentionDays],
	};
}

export const PRUNABLE_RECEIPT_PLACEMENTS_SQL = `WITH roots AS MATERIALIZED (
		SELECT DISTINCT root."placementId"
		FROM machine_usage_receipt root
		WHERE root."predecessorId" IS NULL
	)
	SELECT placement.id AS "placementId"
	FROM roots
	JOIN sandbox_placement placement ON placement.id = roots."placementId"
	WHERE placement."releasedAt" < ${AUDIT_WINDOW_START_SQL}
		AND NOT EXISTS (
			SELECT 1 FROM billing_line_item line
			WHERE line."placementId" = placement.id AND ${OPEN_LINE_SQL}
		)
	LIMIT ?`;

export function placementReceipts(
	placementId: string
): EvidenceRetentionPredicate {
	return {
		where: 'target."placementId" = ?',
		bindings: [placementId],
		orderBy: 'target."sampledAt" DESC',
	};
}
