/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Sandbox } from '../../sandbox/entities/sandbox.entity';
import {
	BILLING_HOLD,
	type SandboxHoldSql,
} from '../../sandbox/values/sandbox-hold-policy.value';
import { UsageMode } from '../constants/usage-lifecycle.constants';

export function sandboxUsageMode(
	sandbox: Pick<Sandbox, 'state' | 'desiredState' | 'machineId'> | null
): UsageMode | null {
	if (!sandbox?.machineId) return null;
	const held = BILLING_HOLD.held(sandbox);
	if (held.compute) return UsageMode.FULL;
	return held.disk ? UsageMode.DISK : null;
}

export function usageModeSql(alias: string): SandboxHoldSql {
	const compute = BILLING_HOLD.computeSql(alias);
	const disk = BILLING_HOLD.diskSql(alias);
	return {
		sql: `(CASE WHEN ${alias}."machineId" IS NULL THEN NULL WHEN ${compute.sql} THEN ?::text WHEN ${disk.sql} THEN ?::text END)`,
		bindings: [
			...compute.bindings,
			UsageMode.FULL,
			...disk.bindings,
			UsageMode.DISK,
		],
	};
}
