/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { TransactionPropagation } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import { Sandbox } from '../../sandbox/entities/sandbox.entity';
import { SandboxPlacement } from '../../sandbox/entities/sandbox-placement.entity';
import { MACHINE_RELIABILITY_EVENT_KIND } from '../constants/machine-reliability.constants';
import { MachineAssessmentService } from './qualification/machine-assessment.service';
import {
	MachineReliabilityService,
	type PlatformPlacementObservationKind,
} from './qualification/machine-reliability.service';

@Injectable()
export class MachinePlatformObservationService {
	constructor(
		private readonly entityManager: EntityManager,
		private readonly reliability: MachineReliabilityService,
		private readonly assessments: MachineAssessmentService
	) {}

	async observePlacement(
		kind: PlatformPlacementObservationKind,
		placementId: string
	): Promise<void> {
		await this.entityManager.transactional(
			async (manager) => {
				const placement = await manager.findOne(SandboxPlacement, {
					id: placementId,
				});
				if (!placement) return;
				const sandbox = await manager.findOne(Sandbox, {
					id: placement.sandboxId,
				});
				if (!sandbox) return;
				const recorded = await this.reliability.recordPlacementObservation(
					manager,
					kind,
					placement,
					sandbox,
					await databaseNow(manager)
				);
				if (recorded)
					await this.assessments.assess(manager, placement.machineId);
			},
			{ propagation: TransactionPropagation.REQUIRED }
		);
	}

	async observeEdgeServed(placementIds: readonly string[]): Promise<void> {
		const candidates = [...new Set(placementIds)];
		if (candidates.length === 0) return;
		const recorded = await this.entityManager.execute<
			{ placementId: string }[]
		>(
			`SELECT DISTINCT event."placementId" FROM machine_reliability_event event
			WHERE event."placementId" = ANY(ARRAY[?]::uuid[]) AND event."eventKind" = ?`,
			[candidates, MACHINE_RELIABILITY_EVENT_KIND.EDGE_SERVED]
		);
		const known = new Set(recorded.map(({ placementId }) => placementId));
		for (const placementId of candidates) {
			if (known.has(placementId)) continue;
			await this.observePlacement(
				MACHINE_RELIABILITY_EVENT_KIND.EDGE_SERVED,
				placementId
			);
		}
	}

	async observeSandbox(
		kind: PlatformPlacementObservationKind,
		sandboxId: string,
		machineId: string
	): Promise<void> {
		const placement = await this.entityManager.findOne(
			SandboxPlacement,
			{ sandboxId, machineId, releasedAt: null },
			{ fields: ['id'], disableIdentityMap: true }
		);
		if (placement) await this.observePlacement(kind, placement.id);
	}
}
