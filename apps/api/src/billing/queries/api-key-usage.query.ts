/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { IsolationLevel } from '@mikro-orm/core';
import type { EntityManager } from '@mikro-orm/postgresql';
import { addDays } from '../../common/utils/time.util';
import { MicroUsd } from '../../common/values/micro-usd.value';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { CAPACITY_HOLD } from '../../sandbox/values/sandbox-hold-policy.value';
import { UsageMode } from '../../usage/constants/usage-lifecycle.constants';
import { FUNDING_POLICY } from '../constants/funding.constants';
import { COMPUTE_BILLING_LINE_SQL } from '../utils/line-item/billing-line-category.util';
import { EFFECTIVE_BILLING_LINE_AMOUNT_SQL } from '../utils/line-item/billing-line-query.util';
import { liveAccrualByPlacement } from './live-accrual.query';
import { hourlyBurn, sandboxBurn } from './price-burn.query';

export interface ApiKeyUsage {
	computeSpendMicroUsd: MicroUsd;
	computeBurnMicroUsdPerHour: MicroUsd;
	runningSandboxes: number;
}

const BILLED_COMPUTE_SQL = `
	SELECT COALESCE(SUM(${EFFECTIVE_BILLING_LINE_AMOUNT_SQL}), 0)::text AS total
	FROM billing_line_item line
	JOIN sandbox ON sandbox.id = line."sandboxId"
	WHERE sandbox."apiKeyId" = ? AND line."periodEnd" >= ? AND ${COMPUTE_BILLING_LINE_SQL}`;

const RUNNING_SANDBOXES_HOLD = CAPACITY_HOLD.computeSql('sandbox');

const RUNNING_SANDBOXES_SQL = `
	SELECT count(*)::text AS count FROM sandbox
	WHERE sandbox."apiKeyId" = ? AND ${RUNNING_SANDBOXES_HOLD.sql}`;

const PRICED_SANDBOXES_SQL = `
	SELECT price."sandboxId" AS id
	FROM placement_price price
	JOIN sandbox ON sandbox.id = price."sandboxId"
	WHERE sandbox."apiKeyId" = ? AND price."endedAt" IS NULL`;

const RUNNING_PERIOD_SANDBOXES_SQL = `
	SELECT period."sandboxId" AS id
	FROM sandbox_usage_periods period
	JOIN sandbox ON sandbox.id = period."sandboxId"
	WHERE sandbox."apiKeyId" = ? AND period."endAt" IS NULL AND period.mode = ?`;

async function sandboxIds(
	manager: EntityManager,
	sql: string,
	params: readonly unknown[]
): Promise<string[]> {
	return (await manager.execute<{ id: string }[]>(sql, [...params])).map(
		({ id }) => id
	);
}

async function runningComputeBurn(
	manager: EntityManager,
	apiKeyId: string
): Promise<MicroUsd> {
	const priced = await sandboxIds(manager, PRICED_SANDBOXES_SQL, [apiKeyId]);
	if (priced.length === 0) return MicroUsd.ZERO;
	return hourlyBurn(
		(await sandboxBurn(manager, { sandboxId: { $in: priced } })).filter(
			({ running }) => running
		)
	);
}

async function runningComputeAccrual(
	manager: EntityManager,
	apiKeyId: string,
	observedAt: Date
): Promise<MicroUsd> {
	const running = await sandboxIds(manager, RUNNING_PERIOD_SANDBOXES_SQL, [
		apiKeyId,
		UsageMode.FULL,
	]);
	if (running.length === 0) return MicroUsd.ZERO;
	const accrual = await liveAccrualByPlacement(
		manager,
		{ sandboxId: { $in: running }, endAt: null, mode: UsageMode.FULL },
		observedAt
	);
	return MicroUsd.sum(accrual.values());
}

export function apiKeyUsage(
	manager: EntityManager,
	apiKeyId: string
): Promise<ApiKeyUsage> {
	return manager.transactional(
		async (snapshot) => {
			const observedAt = await databaseNow(snapshot);
			const [billed] = await snapshot.execute<{ total: string }[]>(
				BILLED_COMPUTE_SQL,
				[apiKeyId, addDays(observedAt, -FUNDING_POLICY.apiKeyBudgetWindowDays)]
			);
			const [running] = await snapshot.execute<{ count: string }[]>(
				RUNNING_SANDBOXES_SQL,
				[apiKeyId, ...RUNNING_SANDBOXES_HOLD.bindings]
			);
			return {
				computeSpendMicroUsd: (billed
					? MicroUsd.parse(billed.total)
					: MicroUsd.ZERO
				).add(await runningComputeAccrual(snapshot, apiKeyId, observedAt)),
				computeBurnMicroUsdPerHour: await runningComputeBurn(
					snapshot,
					apiKeyId
				),
				runningSandboxes: Number(running?.count ?? 0),
			};
		},
		{ isolationLevel: IsolationLevel.REPEATABLE_READ, readOnly: true }
	);
}
