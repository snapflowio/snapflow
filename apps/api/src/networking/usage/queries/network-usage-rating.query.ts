/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const UNRATED_EVIDENCE_SQL = `WITH evidence AS (
		SELECT 'receipt' AS kind, receipt.id, receipt."placementId" AS placement_id,
			receipt."receivedAt" AS arrived_at
		FROM machine_usage_receipt receipt
		WHERE receipt."networkPeriodId" IS NULL AND receipt."receivedAt" < ?
		UNION ALL
		SELECT 'edge', usage.id, usage."placementId", usage."createdAt"
		FROM exposure_network_usage usage
		WHERE usage."periodId" IS NULL AND usage."createdAt" < ?
	)
	SELECT evidence.kind, evidence.id, lease.id AS "leaseId",
		date_trunc('hour', evidence.arrived_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS "periodStart"
	FROM evidence
	JOIN LATERAL (
		SELECT candidate.id FROM sandbox_lease candidate
		WHERE candidate."placementId" = evidence.placement_id
			AND candidate."startedAt" <= evidence.arrived_at
		ORDER BY candidate."startedAt" DESC
		LIMIT 1
	) lease ON true
	ORDER BY "periodStart", "leaseId", evidence.id
	LIMIT ?`;

export const CLAIM_RECEIPTS_SQL = `SELECT receipt.id, receipt."payloadDigest",
		receipt."acceptedInternetEgressDeltaBytes"::text AS "acceptedInternetEgressDeltaBytes",
		receipt."acceptedInternetIngressDeltaBytes"::text AS "acceptedInternetIngressDeltaBytes",
		receipt."clampedInternetEgressBytes"::text AS "clampedInternetEgressBytes",
		receipt."hostEgressDeltaBytes"::text AS "hostEgressDeltaBytes",
		receipt."hostIngressDeltaBytes"::text AS "hostIngressDeltaBytes"
	FROM machine_usage_receipt receipt
	WHERE receipt.id = ANY(ARRAY[?]::uuid[]) AND receipt."networkPeriodId" IS NULL
	ORDER BY receipt.id
	FOR UPDATE`;

export const CLAIM_EDGE_SAMPLES_SQL = `SELECT usage.id, usage."edgeCheckpointId",
		checkpoint.digest AS "edgeCheckpointDigest", usage."backendId",
		usage."edgeBytesIn"::text AS "bytesIn", usage."edgeBytesOut"::text AS "bytesOut",
		usage.billable
	FROM exposure_network_usage usage
	JOIN edge_usage_checkpoint checkpoint ON checkpoint.id = usage."edgeCheckpointId"
	WHERE usage.id = ANY(ARRAY[?]::uuid[]) AND usage."periodId" IS NULL
	ORDER BY usage.id
	FOR UPDATE OF usage`;

export const ASSIGN_RECEIPTS_SQL = `UPDATE machine_usage_receipt SET "networkPeriodId" = ?
	WHERE id = ANY(ARRAY[?]::uuid[])`;

export const ASSIGN_EDGE_SAMPLES_SQL = `UPDATE exposure_network_usage SET "periodId" = ?
	WHERE id = ANY(ARRAY[?]::uuid[])`;
