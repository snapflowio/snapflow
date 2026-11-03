/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const HOST_TRAFFIC_SQL = `WITH recent AS (
		SELECT period.id, period."machineId", period."hostEgressBytes"
		FROM network_usage_period period
		WHERE period."periodStart" >= ?
	), host AS (
		SELECT recent."machineId", SUM(recent."hostEgressBytes") AS bytes
		FROM recent
		GROUP BY recent."machineId"
	), edge AS (
		SELECT recent."machineId", SUM(usage."edgeBytesOut") AS bytes
		FROM recent
		JOIN exposure_network_usage usage ON usage."periodId" = recent.id
		GROUP BY recent."machineId"
	)
	SELECT host."machineId" AS "machineId", host.bytes::text AS "hostEgressBytes",
		COALESCE(edge.bytes, 0)::text AS "edgeEgressBytes"
	FROM host
	LEFT JOIN edge ON edge."machineId" = host."machineId"`;

export const MACHINE_EGRESS_RATES_SQL = `SELECT period."customerOrganizationId" AS "organizationId",
		period."machineId" AS "machineId",
		(SUM(period."internetEgressBytes") / COUNT(DISTINCT (period."leaseId", period."periodStart")))::float8 AS "bytesPerHour"
	FROM network_usage_period period
	WHERE period."periodStart" >= ?
		AND period."customerOrganizationId" <> period."hostOrganizationId"
	GROUP BY period."customerOrganizationId", period."machineId"`;
