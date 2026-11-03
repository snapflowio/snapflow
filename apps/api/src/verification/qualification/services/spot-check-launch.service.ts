/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { randomInt } from 'node:crypto';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { addDays } from '../../../common/utils/time.util';
import { ResourceShape } from '../../../common/values/resource-shape.value';
import { REFERENCE_SHAPES } from '../../../marketplace/machine/constants/pricing.constants';
import { SandboxLease } from '../../../marketplace/machine/entities/sandbox-lease.entity';
import type { MachineCategory } from '../../../marketplace/machine/enums/machine-category.enum';
import { PlacementKind } from '../../../marketplace/machine/enums/placement-kind.enum';
import { SandboxMode } from '../../../sandbox/instance/enums/sandbox-mode.enum';
import { SandboxSnapshotCreateService } from '../../../sandbox/instance/services/lifecycle/sandbox-snapshot-create.service';
import { Machine } from '../../../sandbox/machine/entities/machine.entity';
import type { SettingsSnapshot } from '../../../settings/platform/types/settings.types';
import {
	SPOT_CHECK,
	SPOT_CHECK_ABORT,
	type SpotCheckAbort,
} from '../constants/spot-check.constants';
import { MachineSpotCheck } from '../entities/machine-spot-check.entity';
import { SpotCheckState } from '../enums/spot-check-state.enum';
import type { BenchmarkShapeValues } from '../types/benchmark.types';
import { abortedSpotCheck } from '../utils/spot-check-outcome.util';
import { SpotCheckCompletionService } from './spot-check-completion.service';
import { SpotCheckToolboxService } from './spot-check-toolbox.service';

@Injectable()
export class SpotCheckLaunchService {
	private readonly logger = new Logger(SpotCheckLaunchService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly toolbox: SpotCheckToolboxService,
		private readonly sandboxCreates: SandboxSnapshotCreateService,
		private readonly completion: SpotCheckCompletionService
	) {}

	async launchDue(settings: SettingsSnapshot, now: Date): Promise<void> {
		const due = await this.entityManager.find(
			MachineSpotCheck,
			{ state: SpotCheckState.SCHEDULED, scheduledAt: { $lte: now } },
			{ orderBy: { scheduledAt: 'ASC' }, limit: SPOT_CHECK.BATCH_SIZE }
		);
		for (const check of due) {
			try {
				await this.launch(check, settings, now);
			} catch (error) {
				this.logger.warn(`Spot check ${check.id} could not launch`, error);
				await this.completion.finish(
					check,
					abortedSpotCheck(SPOT_CHECK_ABORT.MACHINE_UNAVAILABLE)
				);
			}
		}
	}

	private async launch(
		check: MachineSpotCheck,
		settings: SettingsSnapshot,
		now: Date
	): Promise<void> {
		const abort = (reason: SpotCheckAbort) =>
			this.completion.finish(check, abortedSpotCheck(reason));
		const organizationId = settings.spotCheckOrganizationId;
		if (!organizationId) return abort(SPOT_CHECK_ABORT.ORGANIZATION_UNSET);
		if (!settings.defaultSnapshot)
			return abort(SPOT_CHECK_ABORT.SNAPSHOT_UNSET);
		const credential = await this.toolbox.credential(
			this.entityManager,
			organizationId,
			now
		);
		if (!credential) return abort(SPOT_CHECK_ABORT.CREDENTIAL_MISSING);
		const machine = await this.entityManager.findOneOrFail(Machine, {
			id: check.machineId,
		});
		if (!machine.category) return abort(SPOT_CHECK_ABORT.BASELINE_MISSING);
		const shape = await this.sampleShape(
			machine,
			machine.category,
			organizationId,
			now
		);
		const sandbox = await this.sandboxCreates.create(
			{
				mode: SandboxMode.STANDARD,
				snapshot: settings.defaultSnapshot,
				cpu: shape.cpu,
				memory: shape.memoryGib,
				disk: shape.diskGib,
				gpu: shape.gpu,
				placement: { kind: PlacementKind.PINNED, machineId: machine.id },
			},
			organizationId,
			credential.principal,
			false
		);
		check.sandboxId = sandbox.id;
		check.state = SpotCheckState.RUNNING;
		check.startedAt = now;
		await this.entityManager.flush();
	}

	private async sampleShape(
		machine: Machine,
		category: MachineCategory,
		spotCheckOrganizationId: string,
		now: Date
	): Promise<BenchmarkShapeValues> {
		const leases = await this.entityManager.find(SandboxLease, {
			machineId: machine.id,
			startedAt: {
				$gte: addDays(now, -SPOT_CHECK.LEASE_LOOKBACK_DAYS),
			},
			customerOrganizationId: {
				$nin: [machine.organizationId, spotCheckOrganizationId],
			},
		});
		if (leases.length > 0) {
			return ResourceShape.fromColumns(
				leases[randomInt(leases.length)]
			).toColumns();
		}
		return REFERENCE_SHAPES[category].toColumns();
	}
}
