/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { lockRowsForNoKeyUpdate } from '../../../infra/database/utils/row-lock.util';
import { Machine } from '../entities/machine.entity';

export function lockMachinesForUpdate(
	manager: EntityManager,
	machineIds: Iterable<string>
): Promise<Machine[]> {
	return lockRowsForNoKeyUpdate(manager, Machine, machineIds);
}

export async function lockMachineForUpdate(
	manager: EntityManager,
	machineId: string
): Promise<Machine | null> {
	const [machine] = await lockMachinesForUpdate(manager, [machineId]);
	return machine ?? null;
}
