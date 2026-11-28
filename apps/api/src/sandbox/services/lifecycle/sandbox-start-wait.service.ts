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
import { addMinutes } from '../../../common/utils/time.util';
import { databaseNow } from '../../../infra/database/utils/database-time.util';
import { SandboxPlacementResolverService } from '../../../placement/services/sandbox-placement-resolver.service';
import { startPendingQuotaUsage } from '../../../placement/utils/pending-quota-usage.util';
import { SettingsService } from '../../../settings/services/settings.service';
import { START_ORIGIN_DESIRED_STATES } from '../../constants/sandbox-state-machine.constants';
import type { Sandbox } from '../../entities/sandbox.entity';
import { SandboxDesiredState } from '../../enums/sandbox-desired-state.enum';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { SandboxConflictException } from '../../exceptions/sandbox-conflict.exception';
import { SandboxRepository } from '../../repositories/sandbox.repository';
import { SandboxQuotaService } from '../sandbox/sandbox-quota.service';

const NO_CAPACITY_REASON =
	'No machine matching the request became available; create the sandbox again or relax its placement';

export function startOriginDesiredState(
	sandbox: Pick<Sandbox, 'pending' | 'desiredState' | 'state'>
): SandboxDesiredState | undefined {
	return sandbox.pending && sandbox.desiredState === SandboxDesiredState.STARTED
		? START_ORIGIN_DESIRED_STATES.get(sandbox.state)
		: undefined;
}

@Injectable()
export class SandboxStartWaitService {
	private readonly logger = new Logger(SandboxStartWaitService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly sandboxRepository: SandboxRepository,
		private readonly quota: SandboxQuotaService,
		private readonly placements: SandboxPlacementResolverService,
		private readonly settings: SettingsService
	) {}

	async deadline(): Promise<Date> {
		const { startWaitMinutes } = await this.settings.get();
		return addMinutes(await databaseNow(this.entityManager), startWaitMinutes);
	}

	async settle(sandbox: Sandbox, now: Date): Promise<void> {
		if (sandbox.state === SandboxState.PENDING_PLACEMENT) {
			if (sandbox.startWaitUntil && sandbox.startWaitUntil > now) return;
			await this.failPendingPlacement(sandbox, NO_CAPACITY_REASON);
			return;
		}
		if (!startOriginDesiredState(sandbox)) {
			await this.sandboxRepository.updateWhere(sandbox.id, {
				updateData: { startWaitUntil: null },
				whereCondition: {
					state: sandbox.state,
					startWaitUntil: sandbox.startWaitUntil,
				},
			});
			return;
		}
		if (sandbox.startWaitUntil && sandbox.startWaitUntil > now) return;
		if (await this.withdraw(sandbox)) {
			this.logger.log(
				`Withdrew the start of sandbox ${sandbox.id}: it did not leave ${sandbox.state} before its wait ended`
			);
		}
	}

	async withdraw(sandbox: Sandbox): Promise<Sandbox | null> {
		const desiredState = startOriginDesiredState(sandbox);
		if (!desiredState) return null;
		let withdrawn: Sandbox;
		try {
			withdrawn = await this.sandboxRepository.updateWhere(sandbox.id, {
				updateData: { desiredState, pending: false, startWaitUntil: null },
				whereCondition: {
					pending: true,
					desiredState: SandboxDesiredState.STARTED,
					state: sandbox.state,
				},
			});
		} catch (error) {
			if (error instanceof SandboxConflictException) return null;
			throw error;
		}
		await this.releasePendingUsage(withdrawn);
		return withdrawn;
	}

	async failPendingPlacement(sandbox: Sandbox, reason: string): Promise<void> {
		let failed: Sandbox;
		try {
			failed = await this.sandboxRepository.updateWhere(sandbox.id, {
				updateData: {
					state: SandboxState.ERROR,
					desiredState: SandboxDesiredState.STOPPED,
					pending: false,
					startWaitUntil: null,
					errorReason: reason,
				},
				whereCondition: {
					pending: true,
					state: SandboxState.PENDING_PLACEMENT,
				},
			});
		} catch (error) {
			if (error instanceof SandboxConflictException) return;
			throw error;
		}
		await this.releasePendingUsage(failed);
		this.logger.log(
			`Sandbox ${sandbox.id} could not be placed before its wait ended: ${reason}`
		);
	}

	private async releasePendingUsage(sandbox: Sandbox): Promise<void> {
		if (await this.placements.runsOnOwnMachines(sandbox)) return;
		const pending = startPendingQuotaUsage(sandbox);
		await this.quota.rollbackPendingUsage(
			sandbox.organizationId,
			sandbox.sandboxClass,
			pending.cpu,
			pending.memory,
			pending.disk,
			pending.gpu
		);
	}
}
