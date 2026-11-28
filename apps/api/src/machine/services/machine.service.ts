/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { QueryOrder } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, NotFoundException } from '@nestjs/common';
import { apiError } from '../../common/utils/error/api-error.util';
import { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { SandboxErrorCode } from '../../sandbox/enums/sandbox-error-code.enum';
import { SandboxState } from '../../sandbox/enums/sandbox-state.enum';
import { SandboxNotFoundException } from '../../sandbox/exceptions/sandbox-not-found.exception';
import { Snapshot } from '../../snapshot/entities/snapshot.entity';
import { Machine } from '../entities/machine.entity';
import { MachineState } from '../enums/machine-state.enum';
import { MachineNotFoundException } from '../exceptions/machine-not-found.exception';

@Injectable()
export class MachineService {
	constructor(private readonly entityManager: EntityManager) {}

	async findDrainingPage(
		afterId: string | null,
		limit: number
	): Promise<Machine[]> {
		return this.entityManager.find(
			Machine,
			{
				draining: true,
				state: { $ne: MachineState.DECOMMISSIONED },
				...(afterId ? { id: { $gt: afterId } } : {}),
			},
			{ orderBy: { id: QueryOrder.ASC }, limit }
		);
	}

	async findReadyIdsPage(
		afterId: string | null,
		limit: number
	): Promise<string[]> {
		const machines = await this.entityManager.find(
			Machine,
			{
				state: MachineState.READY,
				...(afterId ? { id: { $gt: afterId } } : {}),
			},
			{ fields: ['id'], orderBy: { id: QueryOrder.ASC }, limit }
		);
		return machines.map(({ id }) => id);
	}

	async findOne(id: string): Promise<Machine | null> {
		return this.entityManager.findOne(Machine, { id });
	}

	async findOneOrFail(id: string): Promise<Machine> {
		const machine = await this.findOne(id);
		if (!machine) {
			throw new MachineNotFoundException(id);
		}
		return machine;
	}

	async findByIds(machineIds: readonly string[]): Promise<Machine[]> {
		if (machineIds.length === 0) {
			return [];
		}

		return this.entityManager.find(Machine, { id: { $in: machineIds } });
	}

	async findBySandboxId(sandboxId: string): Promise<Machine | null> {
		const sandbox = await this.entityManager.findOne(
			Sandbox,
			{ id: sandboxId, state: { $ne: SandboxState.DESTROYED } },
			{ fields: ['machineId'] }
		);
		if (!sandbox) {
			throw new SandboxNotFoundException(sandboxId);
		}
		if (!sandbox.machineId) {
			throw new NotFoundException(
				apiError(
					SandboxErrorCode.NOT_PLACED,
					`Sandbox ${sandboxId} is not placed on a machine. Start the sandbox, then try again.`
				)
			);
		}

		return this.findOne(sandbox.machineId);
	}

	async getInitialMachineBySnapshotId(snapshotId: string): Promise<Machine> {
		const snapshot = await this.entityManager.findOne(Snapshot, {
			id: snapshotId,
		});
		if (!snapshot) {
			throw new MachineNotFoundException();
		}
		if (!snapshot.initialMachineId) {
			throw new MachineNotFoundException();
		}

		return await this.findOneOrFail(snapshot.initialMachineId);
	}
}
