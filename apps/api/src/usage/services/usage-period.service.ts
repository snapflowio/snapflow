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
import { PlacementPrice } from '../../marketplace/entities/placement-price.entity';
import type { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { SandboxPlacement } from '../../sandbox/entities/sandbox-placement.entity';
import {
	START_MINIMUM_MILLIS,
	UsageMode,
} from '../constants/usage-lifecycle.constants';
import { SandboxUsagePeriod } from '../entities/sandbox-usage-period.entity';
import type { UsageSession } from '../types/usage-session.types';
import { usagePeriodMatches } from '../utils/usage-period-match.util';
import { UsagePeriodFinalizer } from './usage-period-finalizer.service';

function nextSession(
	current: SandboxUsagePeriod | null,
	mode: UsageMode,
	boundary: Date
): UsageSession {
	if (mode !== UsageMode.FULL) {
		return { runningSince: null, minimumMillis: 0 };
	}
	return current?.mode === UsageMode.FULL
		? { runningSince: current.runningSince, minimumMillis: 0 }
		: { runningSince: boundary, minimumMillis: START_MINIMUM_MILLIS };
}

@Injectable()
export class UsagePeriodService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly finalizer: UsagePeriodFinalizer
	) {}

	async transition(
		sandbox: Sandbox,
		mode: UsageMode | null,
		entityManager: EntityManager = this.entityManager
	): Promise<void> {
		await entityManager.transactional(
			async (manager) => {
				const current = await this.lockOpen(manager, sandbox.id);
				if (
					current &&
					mode !== null &&
					(await this.isCurrent(manager, current, sandbox, mode))
				) {
					return;
				}
				const boundary = await databaseNow(manager);
				if (current) await this.close(manager, current, boundary);
				if (mode === null) return;
				await this.open(
					manager,
					sandbox,
					mode,
					boundary,
					nextSession(current, mode, boundary)
				);
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	async isCurrent(
		manager: EntityManager,
		period: SandboxUsagePeriod,
		sandbox: Sandbox,
		mode: UsageMode
	): Promise<boolean> {
		const placement = await manager.findOne(
			SandboxPlacement,
			{ sandboxId: sandbox.id, releasedAt: null },
			{ lockMode: LockMode.PESSIMISTIC_READ }
		);
		return (
			placement !== null &&
			usagePeriodMatches(period, { sandbox, placement, mode })
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
		startAt: Date,
		session: UsageSession
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
		const placementPrice = await manager.findOne(PlacementPrice, {
			sandboxId: sandbox.id,
			placementId: placement.id,
			endedAt: null,
		});
		if (!placementPrice) {
			throw new Error(
				`Billable sandbox ${sandbox.id} has no open placement price`
			);
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
		usagePeriod.hostOrganizationId = placementPrice.hostOrganizationId;
		usagePeriod.placementId = placement.id;
		usagePeriod.machineId = placement.machineId;
		usagePeriod.assignmentGeneration = placement.assignmentGeneration;
		usagePeriod.placementPriceId = placementPrice.id;
		usagePeriod.mode = mode;
		usagePeriod.sandboxClass = sandbox.sandboxClass;
		usagePeriod.minimumMillis = session.minimumMillis;
		usagePeriod.runningSince = fullUsage ? session.runningSince : null;
		manager.persist(usagePeriod);
	}

	async close(
		manager: EntityManager,
		usagePeriod: SandboxUsagePeriod,
		endAt: Date
	): Promise<void> {
		usagePeriod.endAt = endAt;
		await manager.flush();
		await this.finalizer.finalize(manager, usagePeriod);
	}
}
