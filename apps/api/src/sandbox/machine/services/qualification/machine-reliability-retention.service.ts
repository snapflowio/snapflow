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
import { MACHINE_RELIABILITY_RETENTION } from '../../../../billing/ledger/constants/machine-trust.constants';
import { pruneInBatches } from '../../../../infra/database/utils/batched-prune.util';
import { MachineReliabilityEvent } from '../../entities/machine-reliability-event.entity';
import { MachineWorkloadOutcome } from '../../entities/machine-workload-outcome.entity';

const EXPIRED_SQL = (column: string) =>
	`target."${column}" < transaction_timestamp() - (? * interval '1 day')`;

@Injectable()
export class MachineReliabilityRetentionService {
	private readonly logger = new Logger(MachineReliabilityRetentionService.name);

	constructor(private readonly entityManager: EntityManager) {}

	async prune(): Promise<void> {
		const limits = {
			bindings: [MACHINE_RELIABILITY_RETENTION.retentionDays],
			batchSize: MACHINE_RELIABILITY_RETENTION.batchSize,
			maximumBatches: MACHINE_RELIABILITY_RETENTION.maximumBatches,
		};
		const events = await pruneInBatches(this.entityManager, {
			...limits,
			entity: MachineReliabilityEvent,
			where: EXPIRED_SQL('observedAt'),
		});
		const outcomes = await pruneInBatches(this.entityManager, {
			...limits,
			entity: MachineWorkloadOutcome,
			where: EXPIRED_SQL('lastObservedAt'),
		});
		if (events + outcomes > 0) {
			this.logger.log(
				`Pruned ${events} machine reliability events and ${outcomes} workload outcomes`
			);
		}
	}
}
