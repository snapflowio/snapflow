/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomUUID } from 'node:crypto';
import { LockMode, TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { SandboxLease } from '../../marketplace/entities/sandbox-lease.entity';
import type { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { SandboxPlacement } from '../../sandbox/entities/sandbox-placement.entity';
import { UsageMode } from '../constants/usage-lifecycle.constants';
import { SandboxUsagePeriod } from '../entities/sandbox-usage-period.entity';
import { UsagePeriodFinalizer } from './usage-period-finalizer.service';

@Injectable()
export class UsagePeriodService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly finalizer: UsagePeriodFinalizer
	) {}

	async transition(sandbox: Sandbox, mode: UsageMode | null): Promise<void> {
		await this.entityManager.transactional(
			async (manager) => {
				const current = await this.lockOpen(manager, sandbox.id);
				const boundary = await databaseNow(manager);
				if (current) await this.close(manager, current, boundary);
				if (mode !== null) {
					await this.open(manager, sandbox, mode, boundary);
				}
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	async lockOpen(
		manager: EntityManager,
		sandboxId: string
	): Promise<SandboxUsagePeriod | null> {
		return manager.findOne(
			SandboxUsagePeriod,
			{ sandboxId, endAt: null },
			{ lockMode: LockMode.PESSIMISTIC_WRITE }
		);
	}

	async open(
		manager: EntityManager,
		sandbox: Sandbox,
		mode: UsageMode,
		startAt: Date
	): Promise<void> {
		if (!sandbox.machineId) {
			throw new Error(`Billable sandbox ${sandbox.id} has no assigned machine`);
		}
		if (await this.lockOpen(manager, sandbox.id)) return;
		const placement = await manager.findOne(
			SandboxPlacement,
			{ sandboxId: sandbox.id, releasedAt: null },
			{ lockMode: LockMode.PESSIMISTIC_READ }
		);
		if (!placement || placement.machineId !== sandbox.machineId) {
			throw new Error(
				`Billable sandbox ${sandbox.id} has no matching active placement`
			);
		}
		const lease = await manager.findOne(SandboxLease, {
			sandboxId: sandbox.id,
			placementId: placement.id,
			endedAt: null,
		});
		if (!lease) {
			throw new Error(`Billable sandbox ${sandbox.id} has no open lease`);
		}
		const fullUsage = mode === UsageMode.FULL;
		const usagePeriod = new SandboxUsagePeriod();
		usagePeriod.id = randomUUID();
		usagePeriod.sandboxId = sandbox.id;
		usagePeriod.startAt = startAt;
		usagePeriod.endAt = null;
		usagePeriod.cpu = fullUsage ? sandbox.cpu : 0;
		usagePeriod.gpu = fullUsage ? sandbox.gpu : 0;
		usagePeriod.gpuType = fullUsage ? (sandbox.gpuType ?? null) : null;
		usagePeriod.mem = fullUsage ? sandbox.mem : 0;
		usagePeriod.disk = sandbox.disk;
		usagePeriod.customerOrganizationId = sandbox.organizationId;
		usagePeriod.hostOrganizationId = lease.hostOrganizationId;
		usagePeriod.placementId = placement.id;
		usagePeriod.machineId = placement.machineId;
		usagePeriod.assignmentGeneration = placement.assignmentGeneration;
		usagePeriod.leaseId = lease.id;
		usagePeriod.mode = mode;
		usagePeriod.sandboxClass = sandbox.sandboxClass;
		manager.persist(usagePeriod);
	}

	async close(
		manager: EntityManager,
		usagePeriod: SandboxUsagePeriod,
		endAt: Date
	): Promise<void> {
		usagePeriod.endAt = endAt;
		await this.finalizer.finalize(manager, usagePeriod);
	}
}
