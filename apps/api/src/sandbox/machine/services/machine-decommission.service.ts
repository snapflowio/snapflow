/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { RequestContext } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { LogExecution } from '../../../common/decorators/log-execution.decorator';
import { settleSequentially } from '../../../common/utils/concurrency/sequential-async.util';
import { RedisLockProvider } from '../../../infra/redis/providers/redis-lock.provider';
import { SANDBOX_WORKER_LIMITS } from '../../constants/sandbox.constants';
import { SandboxDesiredState } from '../../enums/sandbox-desired-state.enum';
import { MACHINE_DECOMMISSION_CHECK } from '../constants/machine.constants';
import { MachineService } from './machine.service';
import { MachineAdministrationService } from './machine-administration.service';

function activeSandboxCountSql(machineCount: number): string {
	const placeholders = Array.from({ length: machineCount }, () => '?').join(
		', '
	);
	return `SELECT "machineId", COUNT(*)::text AS total
		FROM "sandbox"
		WHERE "machineId" IN (${placeholders}) AND "desiredState" <> ?
		GROUP BY "machineId"`;
}

@Injectable()
export class MachineDecommissionService {
	private readonly logger = new Logger(MachineDecommissionService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly redisLockProvider: RedisLockProvider,
		private readonly machineService: MachineService,
		private readonly machineAdministration: MachineAdministrationService,
		@InjectRedis()
		private readonly redis: Redis
	) {}

	@LogExecution(MACHINE_DECOMMISSION_CHECK.JOB_NAME)
	async handleCheckDecommissionMachines() {
		await RequestContext.create(this.entityManager, async () => {
			await this.redisLockProvider.runExclusive(
				MACHINE_DECOMMISSION_CHECK.JOB_NAME,
				MACHINE_DECOMMISSION_CHECK.LOCK_TTL_SECONDS,
				() => this.checkDrainingPage()
			);
		});
	}

	private async checkDrainingPage(): Promise<void> {
		const afterId = await this.redis.get(MACHINE_DECOMMISSION_CHECK.CURSOR_KEY);
		const drainingMachines = await this.machineService.findDrainingPage(
			afterId,
			SANDBOX_WORKER_LIMITS.machineDecommissionBatchSize
		);
		const lastMachine = drainingMachines.at(-1);
		if (!lastMachine) {
			await this.redis.del(MACHINE_DECOMMISSION_CHECK.CURSOR_KEY);
			return;
		}
		await this.redis.set(MACHINE_DECOMMISSION_CHECK.CURSOR_KEY, lastMachine.id);
		const machineIds = drainingMachines.map((machine) => machine.id);
		const activeSandboxCounts = await this.activeSandboxCounts(machineIds);
		this.logger.debug(`Checking ${machineIds.length} draining machines`);
		await settleSequentially(machineIds, async (machineId) => {
			try {
				await this.evaluateDrainingMachine(
					machineId,
					activeSandboxCounts.get(machineId) ?? 0
				);
			} catch (error) {
				this.logger.error(
					`Error checking draining machine ${machineId}`,
					error
				);
			}
		});
	}

	private async activeSandboxCounts(
		machineIds: readonly string[]
	): Promise<Map<string, number>> {
		const rows = await this.entityManager.execute<
			{ machineId: string; total: string }[]
		>(activeSandboxCountSql(machineIds.length), [
			...machineIds,
			SandboxDesiredState.DESTROYED,
		]);
		return new Map(rows.map((row) => [row.machineId, Number(row.total)]));
	}

	private async evaluateDrainingMachine(
		machineId: string,
		activeSandboxCount: number
	): Promise<void> {
		const checkKey = `${MACHINE_DECOMMISSION_CHECK.DRAINING_CHECK_KEY_PREFIX}${machineId}`;
		if (activeSandboxCount > 0) {
			await this.redis.del(checkKey);
			this.logger.debug(
				`Machine ${machineId} still has ${activeSandboxCount} sandboxes not destroyed, reset its draining checks`
			);
			return;
		}
		const passedChecks = await this.redis.incr(checkKey);
		if (passedChecks < MACHINE_DECOMMISSION_CHECK.DRAINING_CHECKS_REQUIRED) {
			await this.redis.expire(
				checkKey,
				MACHINE_DECOMMISSION_CHECK.DRAINING_CHECK_TTL_SECONDS
			);
			this.logger.debug(
				`Machine ${machineId} draining check passed (${passedChecks}/${MACHINE_DECOMMISSION_CHECK.DRAINING_CHECKS_REQUIRED})`
			);
			return;
		}
		await this.machineAdministration.decommission(machineId);
		await this.redis.del(checkKey);
		this.logger.log(
			`Machine ${machineId} decommissioned after ${MACHINE_DECOMMISSION_CHECK.DRAINING_CHECKS_REQUIRED} successful draining checks`
		);
	}
}
