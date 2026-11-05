/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode, QueryOrder, RequestContext } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { LogExecution } from '../../common/decorators/log-execution.decorator';
import { settleSequentially } from '../../common/utils/concurrency/sequential-async.util';
import {
	addMilliseconds,
	millisecondsBetween,
} from '../../common/utils/time.util';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { RedisLockProvider } from '../../infra/redis/providers/redis-lock.provider';
import { MachineMarketplaceService } from '../../marketplace/services/machine-marketplace.service';
import { SANDBOX_WORKER_LIMITS } from '../../sandbox/constants/sandbox.constants';
import {
	MACHINE_HEALTH_CHECK,
	MACHINE_HEALTH_STALE_THRESHOLD_MS,
} from '../constants/machine.constants';
import type {
	MachineHealthcheckDto,
	MachineServiceHealthDto,
} from '../dto/machine-health.dto';
import { Machine } from '../entities/machine.entity';
import { MachineState } from '../enums/machine-state.enum';
import {
	machineHealthUpdate,
	unhealthyServices,
} from '../utils/machine-health-update.util';
import { staleMachineFilter } from '../utils/machine-staleness.util';

@Injectable()
export class MachineHealthService {
	private readonly logger = new Logger(MachineHealthService.name);
	private readonly serviceStartTime = new Date();

	constructor(
		private readonly entityManager: EntityManager,
		private readonly redisLockProvider: RedisLockProvider,
		private readonly machines: MachineMarketplaceService
	) {}

	async updateMachineHealth(
		machineId: string,
		healthcheck: MachineHealthcheckDto
	): Promise<void> {
		await this.entityManager.transactional(async (manager) => {
			const observedAt = await databaseNow(manager);
			const machine = await manager.findOne(
				Machine,
				{ id: machineId },
				{ lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true }
			);
			if (!machine) {
				this.logger.error(
					`Machine ${machineId} not found when trying to update health`
				);
				return;
			}
			if (machine.state === MachineState.DECOMMISSIONED) {
				this.logger.debug(
					`Machine ${machineId} is decommissioned, not updating health`
				);
				return;
			}
			this.warnUnhealthyServices(machineId, healthcheck.serviceHealth);
			Object.assign(
				machine,
				machineHealthUpdate(machine, healthcheck, observedAt)
			);
			if (healthcheck.inventoryDigest) {
				await this.machines.recordInventoryDigest(
					manager,
					machineId,
					healthcheck.inventoryDigest
				);
			}
		});
	}

	@LogExecution(MACHINE_HEALTH_CHECK.JOB_NAME)
	async handleCheckMachines() {
		await RequestContext.create(this.entityManager, async () => {
			await this.redisLockProvider.runExclusive(
				MACHINE_HEALTH_CHECK.JOB_NAME,
				MACHINE_HEALTH_CHECK.LOCK_TTL_SECONDS,
				() => this.markStaleMachinesUnresponsive()
			);
		});
	}

	private async markStaleMachinesUnresponsive(): Promise<void> {
		if (
			millisecondsBetween(this.serviceStartTime, new Date()) <=
			MACHINE_HEALTH_STALE_THRESHOLD_MS
		) {
			return;
		}
		const staleBefore = addMilliseconds(
			await databaseNow(this.entityManager),
			-MACHINE_HEALTH_STALE_THRESHOLD_MS
		);
		const machines = await this.entityManager.find(
			Machine,
			staleMachineFilter(staleBefore),
			{
				fields: ['id'],
				orderBy: { lastChecked: QueryOrder.ASC },
				limit: SANDBOX_WORKER_LIMITS.machineHealthBatchSize,
			}
		);
		await settleSequentially(machines, (machine) =>
			this.markUnresponsive(machine.id, staleBefore)
		);
	}

	private async markUnresponsive(
		machineId: string,
		staleBefore: Date
	): Promise<void> {
		await this.entityManager.transactional(async (manager) => {
			const machine = await manager.findOne(
				Machine,
				{ id: machineId, ...staleMachineFilter(staleBefore) },
				{ lockMode: LockMode.PESSIMISTIC_WRITE, refresh: true }
			);
			if (!machine) {
				return;
			}
			this.logger.warn(
				`Machine ${machineId} last reported health at ${machine.lastChecked?.toISOString()}, marking as UNRESPONSIVE`
			);
			machine.state = MachineState.UNRESPONSIVE;
		});
	}

	private warnUnhealthyServices(
		machineId: string,
		serviceHealth: readonly MachineServiceHealthDto[] | undefined
	): void {
		const unhealthy = unhealthyServices(serviceHealth);
		if (unhealthy.length === 0) {
			return;
		}
		const summary = unhealthy
			.map(
				(service) =>
					`"${service.serviceName}"${service.errorReason ? ` (${service.errorReason})` : ''}`
			)
			.join(', ');
		this.logger.warn(
			`Machine ${machineId} services reported unhealthy: ${summary}`
		);
	}
}
