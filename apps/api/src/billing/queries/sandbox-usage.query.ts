/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { SOFT_DELETED_SANDBOX_NAME_PREFIX } from '../../sandbox/constants/sandbox.constants';
import {
	BillingChargeClass,
	BillingEvidenceStatus,
} from '../constants/billing.constants';
import { EFFECTIVE_BILLING_LINE_AMOUNT_SQL } from '../utils/line-item/billing-line-query.util';

export const SandboxUsageSort = {
	LAST_ACTIVITY: 'last_activity',
	TOTAL: 'total',
} as const;

export type SandboxUsageSort =
	(typeof SandboxUsageSort)[keyof typeof SandboxUsageSort];

export const SandboxUsageSortDirection = {
	ASC: 'asc',
	DESC: 'desc',
} as const;

export type SandboxUsageSortDirection =
	(typeof SandboxUsageSortDirection)[keyof typeof SandboxUsageSortDirection];

export interface SandboxUsageRow {
	sandboxId: string;
	sandboxName: string | null;
	computeMicroUsd: string;
	networkMicroUsd: string;
	totalMicroUsd: string;
	lineCount: number;
	firstServiceStart: unknown;
	lastServiceThrough: unknown;
	evidence: Record<BillingEvidenceStatus, number>;
}

export interface SandboxUsageKeyset {
	value: string;
	sandboxId: string;
}

export interface SandboxUsageFilter {
	organizationId: string;
	search?: string;
	sandboxId?: string;
	from?: Date;
	to?: Date;
}

export interface SandboxUsageRowsInput extends SandboxUsageFilter {
	limit: number;
	sort: SandboxUsageSort;
	direction: SandboxUsageSortDirection;
	after?: SandboxUsageKeyset;
}

const EVIDENCE_STATUSES = Object.values(BillingEvidenceStatus);

const LAST_SERVICE_THROUGH_SQL = `date_trunc('milliseconds', MAX(line."serviceThrough"))`;
const TOTAL_SQL = `COALESCE(SUM(${EFFECTIVE_BILLING_LINE_AMOUNT_SQL}), 0)`;

const SORT_SQL = {
	[SandboxUsageSort.LAST_ACTIVITY]: {
		expression: LAST_SERVICE_THROUGH_SQL,
		parameter: '?::timestamptz',
	},
	[SandboxUsageSort.TOTAL]: { expression: TOTAL_SQL, parameter: '?::numeric' },
} as const satisfies Record<
	SandboxUsageSort,
	{ expression: string; parameter: string }
>;

const DIRECTION_SQL = {
	[SandboxUsageSortDirection.ASC]: { order: 'ASC', after: '>' },
	[SandboxUsageSortDirection.DESC]: { order: 'DESC', after: '<' },
} as const satisfies Record<
	SandboxUsageSortDirection,
	{ order: string; after: string }
>;

const EVIDENCE_COUNTS_SQL = `json_build_object(${EVIDENCE_STATUSES.map(
	() => `?::text, COUNT(*) FILTER (WHERE line."evidenceStatus" = ?)`
).join(', ')})`;

const EVIDENCE_COUNTS_PARAMETERS = EVIDENCE_STATUSES.flatMap((status) => [
	status,
	status,
]);

const SEARCH_SQL = `(strpos(lower(sandbox.name), lower(?)) > 0 OR strpos(lower(line."sandboxId"), lower(?)) > 0)`;

const SANDBOX_JOIN_SQL = `LEFT JOIN "sandbox" sandbox
		   ON sandbox.id = line."sandboxId"
		  AND sandbox."organizationId" = line."customerOrganizationId"
		  AND NOT starts_with(sandbox.name, ?)`;

interface SqlClause {
	sql: string;
	parameters: unknown[];
}

export function sandboxUsageRows(
	manager: EntityManager,
	input: SandboxUsageRowsInput
): Promise<SandboxUsageRow[]> {
	const sort = SORT_SQL[input.sort];
	const direction = DIRECTION_SQL[input.direction];
	const where = usageWhere(input);
	const keyset = input.after
		? {
				sql: `HAVING (${sort.expression}, line."sandboxId") ${direction.after} (${sort.parameter}, ?)`,
				parameters: [input.after.value, input.after.sandboxId],
			}
		: { sql: '', parameters: [] };
	return manager.execute<SandboxUsageRow[]>(
		`SELECT line."sandboxId" AS "sandboxId",
				sandbox.name AS "sandboxName",
				COALESCE(SUM(CASE WHEN line."chargeClass" = ? THEN ${EFFECTIVE_BILLING_LINE_AMOUNT_SQL} ELSE 0 END), 0) AS "computeMicroUsd",
				COALESCE(SUM(CASE WHEN line."chargeClass" = ? THEN ${EFFECTIVE_BILLING_LINE_AMOUNT_SQL} ELSE 0 END), 0) AS "networkMicroUsd",
				${TOTAL_SQL} AS "totalMicroUsd",
				COUNT(*)::integer AS "lineCount",
				MIN(line."periodStart") AS "firstServiceStart",
				${LAST_SERVICE_THROUGH_SQL} AS "lastServiceThrough",
				${EVIDENCE_COUNTS_SQL} AS evidence
		 FROM "billing_line_item" line
		 ${SANDBOX_JOIN_SQL}
		 WHERE ${where.sql}
		 GROUP BY line."sandboxId", sandbox.name
		 ${keyset.sql}
		 ORDER BY ${sort.expression} ${direction.order}, line."sandboxId" ${direction.order}
		 LIMIT ?`,
		[
			BillingChargeClass.COMPUTE,
			BillingChargeClass.NETWORK,
			...EVIDENCE_COUNTS_PARAMETERS,
			SOFT_DELETED_SANDBOX_NAME_PREFIX,
			...where.parameters,
			...keyset.parameters,
			input.limit,
		]
	);
}

export async function sandboxUsageTotal(
	manager: EntityManager,
	filter: SandboxUsageFilter
): Promise<string> {
	const where = usageWhere(filter);
	const [row] = await manager.execute<{ totalMicroUsd: string }[]>(
		`SELECT ${TOTAL_SQL} AS "totalMicroUsd"
		 FROM "billing_line_item" line
		 ${SANDBOX_JOIN_SQL}
		 WHERE ${where.sql}`,
		[SOFT_DELETED_SANDBOX_NAME_PREFIX, ...where.parameters]
	);
	return String(row.totalMicroUsd);
}

function usageWhere(filter: SandboxUsageFilter): SqlClause {
	return conjunction([
		{
			sql: `line."customerOrganizationId" = ?`,
			parameters: [filter.organizationId],
		},
		filter.sandboxId
			? { sql: `line."sandboxId" = ?`, parameters: [filter.sandboxId] }
			: null,
		filter.search
			? { sql: SEARCH_SQL, parameters: [filter.search, filter.search] }
			: null,
		filter.from
			? { sql: `line."serviceThrough" >= ?`, parameters: [filter.from] }
			: null,
		filter.to
			? { sql: `line."serviceThrough" < ?`, parameters: [filter.to] }
			: null,
	]);
}

function conjunction(clauses: readonly (SqlClause | null)[]): SqlClause {
	const present = clauses.filter((clause) => clause !== null);
	return {
		sql: present.map((clause) => clause.sql).join(' AND '),
		parameters: present.flatMap((clause) => clause.parameters),
	};
}
