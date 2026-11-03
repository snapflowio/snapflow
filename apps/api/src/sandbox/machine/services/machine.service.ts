/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type EntityRepository, QueryOrder } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import {
	BadRequestException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { Sandbox } from '../../instance/entities/sandbox.entity';
import { SandboxState } from '../../instance/enums/sandbox-state.enum';
import { Snapshot } from '../../snapshot/entities/snapshot.entity';
import { Machine } from '../entities/machine.entity';
import { MachineState } from '../enums/machine-state.enum';

@Injectable()
export class MachineService {
	constructor(private readonly entityManager: EntityManager) {}

	private get machineRepository(): EntityRepository<Machine> {
		return this.entityManager.getRepository(Machine);
	}

	async findDrainingPage(
		afterId: string | null,
		limit: number
	): Promise<Machine[]> {
		return this.machineRepository.find(
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
		const machines = await this.machineRepository.find(
			{
				state: MachineState.READY,
				...(afterId ? { id: { $gt: afterId } } : {}),
			},
			{ fields: ['id'], orderBy: { id: QueryOrder.ASC }, limit }
		);
		return machines.map(({ id }) => id);
	}

	async findOne(id: string): Promise<Machine | null> {
		return this.machineRepository.findOne({ id });
	}

	async findOneOrFail(id: string): Promise<Machine> {
		const machine = await this.findOne(id);
		if (!machine) {
			throw new NotFoundException(`Machine with ID ${id} not found`);
		}
		return machine;
	}

	async findByIds(machineIds: readonly string[]): Promise<Machine[]> {
		if (machineIds.length === 0) {
			return [];
		}

		return this.machineRepository.find({ id: { $in: machineIds } });
	}

	async findBySandboxId(sandboxId: string): Promise<Machine | null> {
		const sandbox = await this.entityManager.findOne(
			Sandbox,
			{ id: sandboxId, state: { $ne: SandboxState.DESTROYED } },
			{ fields: ['machineId'] }
		);
		if (!sandbox) {
			throw new NotFoundException(`Sandbox with ID ${sandboxId} not found`);
		}
		if (!sandbox.machineId) {
			throw new NotFoundException(
				`Sandbox with ID ${sandboxId} does not have a machine`
			);
		}

		return this.findOne(sandbox.machineId);
	}

	async getInitialMachineBySnapshotId(snapshotId: string): Promise<Machine> {
		const snapshot = await this.entityManager.findOne(Snapshot, {
			id: snapshotId,
		});
		if (!snapshot) {
			throw new NotFoundException('Snapshot machine not found');
		}
		if (!snapshot.initialMachineId) {
			throw new BadRequestException('Initial machine not found');
		}

		return await this.findOneOrFail(snapshot.initialMachineId);
	}
}
