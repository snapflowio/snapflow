/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ResourceShape } from '../../../common/values/resource-shape.value';
import type { Sandbox } from '../../../sandbox/entities/sandbox.entity';

export type DesiredStateFields = Pick<
	Sandbox,
	| 'machineId'
	| 'specGeneration'
	| 'runtimeLifecycle'
	| 'cpu'
	| 'mem'
	| 'disk'
	| 'gpu'
>;

function listingMachineId(sandbox: DesiredStateFields): string | null {
	return sandbox.runtimeLifecycle === null ? null : sandbox.machineId;
}

export function desiredStateMachineIds(
	previous: DesiredStateFields | null,
	current: DesiredStateFields
): string[] {
	const previousMachineId = previous ? listingMachineId(previous) : null;
	const currentMachineId = listingMachineId(current);
	if (previousMachineId === null && currentMachineId === null) return [];
	const changed =
		previous === null ||
		previousMachineId !== currentMachineId ||
		previous.specGeneration !== current.specGeneration ||
		!ResourceShape.fromSandbox(previous).equals(
			ResourceShape.fromSandbox(current)
		);
	if (!changed) return [];
	return [
		...new Set(
			[previousMachineId, currentMachineId].filter(
				(machineId): machineId is string => machineId !== null
			)
		),
	];
}
