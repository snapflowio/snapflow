/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { LockMode, TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import type { Machine } from '../../machine/entities/machine.entity';
import { MachineObservation } from '../../machine/entities/machine-observation.entity';
import type { MachineSession } from '../../machine/entities/machine-session.entity';
import { MachineSessionService } from '../../machine/services/machine-session.service';
import { MachineAssessmentService } from '../../machine/services/qualification/machine-assessment.service';
import { accumulateUptime } from '../../machine/utils/machine-uptime.util';

@Injectable()
export class MachineCapacityService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly machineSessionService: MachineSessionService,
		private readonly assessments: MachineAssessmentService
	) {}

	async recordObservation(
		machine: Machine,
		session: MachineSession
	): Promise<void> {
		await this.entityManager.transactional(
			async (manager) => {
				await this.machineSessionService.assertCurrent(
					manager,
					machine.id,
					session.id
				);
				const current = await manager.findOne(
					MachineObservation,
					{ machineId: machine.id },
					{ lockMode: LockMode.PESSIMISTIC_WRITE }
				);
				const observedAt = await databaseNow(manager);
				const uptime = accumulateUptime(
					{
						onlineSeconds: current?.uptimeOnlineSeconds ?? 0,
						observedSeconds: current?.uptimeObservedSeconds ?? 0,
					},
					current?.observedAt ?? null,
					observedAt
				);
				const capacityChanged =
					!current ||
					current.cpu !== machine.cpu ||
					current.memoryGiB !== machine.memoryGiB ||
					current.diskGiB !== machine.diskGiB;
				const observation = current ?? new MachineObservation();
				Object.assign(observation, {
					machineId: machine.id,
					sessionId: session.id,
					generation: (current?.generation ?? 0) + 1,
					cpu: machine.cpu,
					memoryGiB: machine.memoryGiB,
					diskGiB: machine.diskGiB,
					observedAt,
					uptimeOnlineSeconds: uptime.onlineSeconds,
					uptimeObservedSeconds: uptime.observedSeconds,
				});
				if (!current) manager.persist(observation);
				if (!capacityChanged) return;
				await manager.flush();
				await this.assessments.assess(manager, machine.id);
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}
}
