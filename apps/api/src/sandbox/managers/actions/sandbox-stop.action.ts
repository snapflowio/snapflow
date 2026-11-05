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
import { MILLISECONDS_PER_MINUTE } from '../../../common/constants/time.constants';
import { millisecondsBetween } from '../../../common/utils/time.util';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { CONVERGENCE_TIMEOUT_MINUTES } from '../../machine/constants/machine-desired-state.constants';
import { MachineState } from '../../machine/enums/machine-state.enum';
import { MachineService } from '../../machine/services/machine.service';
import { SandboxRepository } from '../../repositories/sandbox.repository';
import { SandboxActivityService } from '../../services/sandbox/sandbox-activity.service';
import { DONT_SYNC_AGAIN, SandboxAction, SyncState } from './sandbox.action';

const STOPPABLE_STATES: ReadonlySet<SandboxState> = new Set([
	SandboxState.STARTED,
	SandboxState.PAUSED,
]);

@Injectable()
export class SandboxStopAction extends SandboxAction {
	constructor(
		protected readonly machineService: MachineService,
		protected readonly sandboxRepository: SandboxRepository,
		private readonly sandboxActivityService: SandboxActivityService
	) {
		super(machineService, sandboxRepository);
	}

	async run(sandbox: Sandbox, force?: boolean): Promise<SyncState> {
		if (!sandbox.machineId) {
			await this.updateSandboxState(sandbox, { state: SandboxState.STOPPED });
			return DONT_SYNC_AGAIN;
		}
		if (sandbox.state === SandboxState.RESTORING) {
			return this.expireStalledMigration(sandbox);
		}
		if (!STOPPABLE_STATES.has(sandbox.state)) {
			return DONT_SYNC_AGAIN;
		}
		const machine = await this.machineService.findOneOrFail(sandbox.machineId);
		if (machine.state !== MachineState.READY) {
			return DONT_SYNC_AGAIN;
		}

		await this.updateSandboxState(
			sandbox,
			{ state: SandboxState.STOPPING },
			{
				runtimeIntent: {
					lifecycle: SandboxLifecycle.STOPPED,
					directives: { forceStop: force === true },
				},
			}
		);
		return DONT_SYNC_AGAIN;
	}

	private async expireStalledMigration(sandbox: Sandbox): Promise<SyncState> {
		const lastActivityAt = await this.sandboxActivityService.getLastActivityAt(
			sandbox.id
		);
		if (
			lastActivityAt &&
			millisecondsBetween(lastActivityAt, new Date()) >
				CONVERGENCE_TIMEOUT_MINUTES.restoring * MILLISECONDS_PER_MINUTE
		) {
			this.logger.warn(
				`Migration of sandbox ${sandbox.id} to machine ${sandbox.machineId} stalled; detaching it`
			);
			await this.updateSandboxState(sandbox, {
				state: SandboxState.STOPPED,
				machineId: null,
				prevMachineId: null,
			});
		}
		return DONT_SYNC_AGAIN;
	}
}
