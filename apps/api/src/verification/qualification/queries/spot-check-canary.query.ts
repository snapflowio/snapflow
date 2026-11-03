/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const CANARY_METER_WINDOW_SQL = `WITH placement AS (
		SELECT candidate.id FROM sandbox_placement candidate
		WHERE candidate."sandboxId" = ?
		ORDER BY candidate."placedAt" DESC
		LIMIT 1
	), bounds AS (
		SELECT placement.id AS placement_id,
			(SELECT MAX(opening."sampledAt") FROM machine_usage_receipt opening
				WHERE opening."placementId" = placement.id AND opening."receivedAt" <= ?) AS opened_at,
			(SELECT MIN(closing."sampledAt") FROM machine_usage_receipt closing
				WHERE closing."placementId" = placement.id AND closing."receivedAt" >= ?) AS closed_at
		FROM placement
	)
	SELECT bounds.closed_at IS NOT NULL AS settled,
		COALESCE(SUM(receipt."acceptedInternetEgressDeltaBytes" + receipt."hostEgressDeltaBytes"), 0)::text AS "egressBytes",
		COALESCE(SUM(receipt."acceptedInternetIngressDeltaBytes" + receipt."hostIngressDeltaBytes"), 0)::text AS "ingressBytes"
	FROM bounds
	LEFT JOIN machine_usage_receipt receipt ON receipt."placementId" = bounds.placement_id
		AND receipt."sampledAt" > COALESCE(bounds.opened_at, '-infinity'::timestamptz)
		AND receipt."sampledAt" <= bounds.closed_at
	GROUP BY bounds.closed_at`;
