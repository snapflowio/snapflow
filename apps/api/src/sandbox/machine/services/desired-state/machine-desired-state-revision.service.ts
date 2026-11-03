/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { raw } from '@mikro-orm/core';
import type { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { ControlWakeService } from '../../../../infra/control-wake/services/control-wake.service';
import { MACHINE_DESIRED_STATE_WAKE_TOPIC } from '../../constants/machine-desired-state.constants';
import { Machine } from '../../entities/machine.entity';

@Injectable()
export class MachineDesiredStateRevisionService {
	constructor(private readonly wakes: ControlWakeService) {}

	async advance(
		manager: EntityManager,
		machineIds: Iterable<string>
	): Promise<void> {
		const ids = [...new Set(machineIds)].sort();
		for (const id of ids) {
			await manager.nativeUpdate(
				Machine,
				{ id },
				{
					desiredStateRevision: raw('"desiredStateRevision" + 1'),
					desiredStateGeneratedAt: raw('now()'),
				}
			);
		}
		this.wakes.notifyAfterCommit(
			manager,
			MACHINE_DESIRED_STATE_WAKE_TOPIC,
			ids
		);
	}
}
