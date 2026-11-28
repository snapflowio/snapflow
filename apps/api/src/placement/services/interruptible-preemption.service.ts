/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { databaseNow } from '../../infra/database/utils/database-time.util';
import type { GetMachineParams } from '../../machine/types/machine-scheduling.types';
import {
	computeExcluding,
	wholeMachineGateSql,
	workloadGateSql,
} from '../../marketplace/queries/machine-eligibility.query';
import { CARD_MACHINE_HOUR_SQL } from '../../marketplace/queries/offer-card-columns.query';
import { SandboxDesiredState } from '../../sandbox/enums/sandbox-desired-state.enum';
import { SandboxState } from '../../sandbox/enums/sandbox-state.enum';
import { sandboxPreemptedWebhook } from '../../webhook/utils/domain-webhook.util';
import { publishWebhook } from '../../webhook/utils/webhook-publish.util';
import { requestedShape } from '../queries/machine-candidates.query';
import { isInterruptiblePlacement } from '../utils/sandbox-placement.util';

const VICTIMS_SQL = `SELECT sandbox.id, sandbox."organizationId" AS organization_id, sandbox.name
	FROM sandbox
	LEFT JOIN placement_price price ON price."sandboxId" = sandbox.id AND price."endedAt" IS NULL
	LEFT JOIN machine_price_card card ON card.id = price."priceCardId"
	WHERE sandbox."machineId" = ? AND sandbox."placementInterruptible"
		AND sandbox."preemptedAt" IS NULL AND sandbox.pending = false
		AND sandbox.state = ? AND sandbox."desiredState" = ?
	ORDER BY ${CARD_MACHINE_HOUR_SQL} * card."interruptibleBasisPoints" ASC NULLS FIRST,
		price."startedAt" DESC NULLS LAST, sandbox.id ASC
	FOR UPDATE OF sandbox SKIP LOCKED`;

const MARK_PREEMPTED_SQL = `UPDATE sandbox SET "preemptedAt" = ?
	WHERE id = ANY(ARRAY[?]::varchar[])`;

interface VictimRow {
	id: string;
	organization_id: string;
	name: string;
}

@Injectable()
export class InterruptiblePreemptionService {
	async makeRoom(
		manager: EntityManager,
		machineId: string,
		params: GetMachineParams
	): Promise<boolean> {
		if (isInterruptiblePlacement(params.placement)) return true;
		if (await this.fits(manager, machineId, params, [])) return true;
		const candidates = await manager.execute<VictimRow[]>(VICTIMS_SQL, [
			machineId,
			SandboxState.STARTED,
			SandboxDesiredState.STARTED,
		]);
		const victims: VictimRow[] = [];
		for (const candidate of candidates) {
			victims.push(candidate);
			const victimIds = victims.map(({ id }) => id);
			if (await this.fits(manager, machineId, params, victimIds)) {
				await this.preempt(manager, machineId, victims);
				return true;
			}
		}
		return false;
	}

	private async fits(
		manager: EntityManager,
		machineId: string,
		params: GetMachineParams,
		victimIds: readonly string[]
	): Promise<boolean> {
		const shape = requestedShape(params);
		const compute = computeExcluding(victimIds);
		const gate = params.placement.wholeMachine
			? wholeMachineGateSql(shape.diskGiB, compute)
			: workloadGateSql(shape, compute);
		const [row] = await manager.execute<{ fits: boolean }[]>(
			`SELECT ${gate.sql} AS fits FROM machine WHERE machine.id = ?`,
			[...gate.bindings, machineId]
		);
		return row?.fits === true;
	}

	private async preempt(
		manager: EntityManager,
		machineId: string,
		victims: readonly VictimRow[]
	): Promise<void> {
		const preemptedAt = await databaseNow(manager);
		await manager.execute(MARK_PREEMPTED_SQL, [
			preemptedAt,
			victims.map(({ id }) => id),
		]);
		for (const victim of victims) {
			await publishWebhook(
				manager,
				sandboxPreemptedWebhook(
					{
						id: victim.id,
						organizationId: victim.organization_id,
						name: victim.name,
					},
					machineId,
					preemptedAt
				)
			);
		}
	}
}
