/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { CreateRequestContext } from '@mikro-orm/decorators/legacy';
import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { MILLISECONDS_PER_DAY } from '../../common/constants/time.constants';
import { LogExecution } from '../../common/decorators/log-execution.decorator';
import { addMilliseconds } from '../../common/utils/time.util';
import { pruneInBatches } from '../../infra/database/utils/batched-prune.util';
import { Sandbox } from '../entities/sandbox.entity';
import { SandboxDesiredState } from '../enums/sandbox-desired-state.enum';
import { SandboxState } from '../enums/sandbox-state.enum';
import { DESTROYED_SANDBOX_FIELDS } from '../utils/state/sandbox-invariants.util';

const STALE_SANDBOX = {
	RETENTION_DAYS: 7,
	BATCH_SIZE: 500,
	MAXIMUM_BATCHES: 20,
} as const;

const SANDBOX_REFERENCES = [
	'sandbox_placement',
	'sandbox_exposure',
	'secret_delivery_event',
	'machine_spot_check',
	'placement_price',
	'sandbox_billable_usage',
] as const;

const UNREFERENCED_SQL = SANDBOX_REFERENCES.map(
	(table) =>
		`NOT EXISTS (SELECT 1 FROM ${table} reference WHERE reference."sandboxId" = target.id)`
).join(' AND ');

const STALE_SQL = `target.state = ? AND target."desiredState" = ?
	AND target."updatedAt" < transaction_timestamp() - (? * interval '1 day')
	AND ${UNREFERENCED_SQL}`;

@Injectable()
export class SandboxCleanupManager {
	private readonly logger = new Logger(SandboxCleanupManager.name);

	constructor(private readonly entityManager: EntityManager) {}

	get em(): EntityManager {
		return this.entityManager;
	}

	@LogExecution('cleanup-stale-build-failed-sandboxes')
	@CreateRequestContext()
	async cleanupStaleBuildFailedSandboxes(): Promise<void> {
		await this.cleanup(
			SandboxState.BUILD_FAILED,
			SandboxDesiredState.STARTED,
			'stale build failed sandboxes'
		);
	}

	@LogExecution('cleanup-stale-error-sandboxes')
	@CreateRequestContext()
	async cleanupStaleErrorSandboxes(): Promise<void> {
		await this.cleanup(
			SandboxState.ERROR,
			SandboxDesiredState.DESTROYED,
			'stale error sandboxes'
		);
	}

	private async cleanup(
		state: SandboxState,
		desiredState: SandboxDesiredState,
		description: string
	): Promise<void> {
		const deleted = await pruneInBatches(this.entityManager, {
			entity: Sandbox,
			where: STALE_SQL,
			bindings: [state, desiredState, STALE_SANDBOX.RETENTION_DAYS],
			batchSize: STALE_SANDBOX.BATCH_SIZE,
			maximumBatches: STALE_SANDBOX.MAXIMUM_BATCHES,
		});
		const retired = await this.entityManager.nativeUpdate(
			Sandbox,
			{
				state,
				desiredState,
				updatedAt: {
					$lt: addMilliseconds(
						new Date(),
						-STALE_SANDBOX.RETENTION_DAYS * MILLISECONDS_PER_DAY
					),
				},
			},
			{
				state: SandboxState.DESTROYED,
				desiredState: SandboxDesiredState.DESTROYED,
				...DESTROYED_SANDBOX_FIELDS,
			}
		);
		if (deleted + retired > 0) {
			this.logger.debug(
				`Deleted ${deleted} and retired ${retired} ${description}`
			);
		}
	}
}
