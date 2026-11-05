/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import { SandboxLifecycle } from '@snapflow/machine-proto';
import { MachineState } from '../../../machine/enums/machine-state.enum';
import { MachineService } from '../../../machine/services/machine.service';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { SandboxRepository } from '../../repositories/sandbox.repository';
import { DONT_SYNC_AGAIN, SandboxAction, SyncState } from './sandbox.action';

@Injectable()
export class SandboxDestroyAction extends SandboxAction {
	constructor(
		protected readonly machineService: MachineService,
		protected readonly sandboxRepository: SandboxRepository
	) {
		super(machineService, sandboxRepository);
	}

	async run(sandbox: Sandbox): Promise<SyncState> {
		if (
			sandbox.state === SandboxState.DESTROYED ||
			sandbox.state === SandboxState.DESTROYING
		) {
			return DONT_SYNC_AGAIN;
		}

		if (!sandbox.machineId || sandbox.runtimeLifecycle === null) {
			await this.updateSandboxState(sandbox, {
				state: SandboxState.DESTROYED,
			});
			return DONT_SYNC_AGAIN;
		}

		const machine = await this.machineService.findOneOrFail(sandbox.machineId);
		if (machine.state !== MachineState.READY) {
			return DONT_SYNC_AGAIN;
		}

		await this.updateSandboxState(
			sandbox,
			{ state: SandboxState.DESTROYING },
			{ runtimeIntent: { lifecycle: SandboxLifecycle.DESTROYED } }
		);
		return DONT_SYNC_AGAIN;
	}
}
