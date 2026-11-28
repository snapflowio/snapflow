/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Sandbox } from '../../sandbox/entities/sandbox.entity';
import type { SandboxPlacement } from '../../sandbox/entities/sandbox-placement.entity';
import { UsageMode } from '../constants/usage-lifecycle.constants';
import type { SandboxUsagePeriod } from '../entities/sandbox-usage-period.entity';

interface UsagePeriodTarget {
	sandbox: Pick<Sandbox, 'machineId' | 'cpu' | 'mem' | 'gpu' | 'disk'>;
	placement: Pick<
		SandboxPlacement,
		'id' | 'machineId' | 'assignmentGeneration'
	>;
	mode: UsageMode;
}

export function usagePeriodMatches(
	period: SandboxUsagePeriod,
	{ sandbox, placement, mode }: UsagePeriodTarget
): boolean {
	const computeMatches =
		mode === UsageMode.FULL
			? period.cpu === sandbox.cpu &&
				period.mem === sandbox.mem &&
				period.gpu === sandbox.gpu
			: period.cpu === 0 && period.mem === 0 && period.gpu === 0;
	return (
		period.mode === mode &&
		placement.machineId === sandbox.machineId &&
		period.machineId === sandbox.machineId &&
		period.placementId === placement.id &&
		period.assignmentGeneration === placement.assignmentGeneration &&
		period.disk === sandbox.disk &&
		computeMatches
	);
}
