/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IsolatedEntityManagerContext } from '../../../common/decorators/isolated-entity-manager-context.decorator';
import { SandboxEvents } from '../constants/sandbox-events.constants';
import { Sandbox } from '../entities/sandbox.entity';
import { SandboxFork } from '../entities/sandbox-fork.entity';
import { SandboxState } from '../enums/sandbox-state.enum';
import { SandboxStateUpdatedEvent } from '../events/sandbox-state-updated.event';
import { SandboxRepository } from '../repositories/sandbox.repository';

@Injectable()
export class SandboxForkSourceListener {
	private readonly logger = new Logger(SandboxForkSourceListener.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly sandboxRepository: SandboxRepository
	) {}

	@OnEvent(SandboxEvents.STATE_UPDATED)
	@IsolatedEntityManagerContext()
	async settleForkSource(event: SandboxStateUpdatedEvent): Promise<void> {
		if (event.oldState !== SandboxState.CREATING) return;
		const fork = await this.entityManager
			.getRepository(SandboxFork)
			.findOne({ childId: event.sandbox.id });
		if (!fork) return;
		const source = await this.entityManager.findOne(Sandbox, {
			id: fork.parentId,
		});
		if (source?.state !== SandboxState.FORKING) return;
		const restingState = source.restingState();
		if (!restingState) {
			this.logger.warn(
				`Fork source ${source.id} has no resting state for desired state ${source.desiredState}`
			);
			return;
		}
		await this.sandboxRepository.updateWhere(source.id, {
			updateData: { state: restingState },
			whereCondition: { state: SandboxState.FORKING },
		});
	}
}
