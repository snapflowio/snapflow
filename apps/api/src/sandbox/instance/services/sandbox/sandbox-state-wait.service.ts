/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { MILLISECONDS_PER_SECOND } from '../../../../common/constants/time.constants';
import { ControlWakeService } from '../../../../infra/control-wake/services/control-wake.service';
import { SANDBOX_STATE_WAKE_TOPIC } from '../../constants/sandbox-state-wait.constants';
import type { Sandbox } from '../../entities/sandbox.entity';
import type { SandboxState } from '../../enums/sandbox-state.enum';
import { deriveSandboxResponseState } from '../../utils/sandbox-response-state.util';
import { SandboxService } from './sandbox.service';

const RETURN_DESTROYED = true;

@Injectable()
export class SandboxStateWaitService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly sandboxService: SandboxService,
		private readonly wakes: ControlWakeService
	) {}

	async awaitChange(
		sandboxIdOrName: string,
		organizationId: string,
		observedState: SandboxState,
		waitSeconds: number
	): Promise<Sandbox> {
		const requested = await this.sandboxService.findOneByIdOrName(
			sandboxIdOrName,
			organizationId
		);
		if (
			responseState(requested) !== observedState ||
			waitSeconds === 0 ||
			this.wakes.isStopping()
		) {
			return requested;
		}
		const wakeVersion = this.wakes.capture(
			SANDBOX_STATE_WAKE_TOPIC,
			requested.id
		);
		const current = await this.reload(requested);
		if (responseState(current) !== observedState) return current;
		await this.wakes.waitForChange(
			SANDBOX_STATE_WAKE_TOPIC,
			requested.id,
			wakeVersion,
			waitSeconds * MILLISECONDS_PER_SECOND
		);
		return this.reload(requested);
	}

	private reload(sandbox: Sandbox): Promise<Sandbox> {
		return this.sandboxService.findOneByIdOrName(
			sandbox.id,
			sandbox.organizationId,
			RETURN_DESTROYED,
			this.entityManager.fork()
		);
	}
}

function responseState(sandbox: Sandbox): SandboxState {
	return deriveSandboxResponseState(sandbox.state, sandbox.desiredState);
}
