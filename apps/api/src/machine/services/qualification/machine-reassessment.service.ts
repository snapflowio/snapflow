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
import { MACHINE_TRUST_POLICY } from '../../../billing/constants/machine-trust.constants';
import { errorMessage } from '../../../common/utils/error/error.util';
import { MachineState } from '../../enums/machine-state.enum';
import { MachineAssessmentService } from './machine-assessment.service';

const DUE_MACHINES_SQL = `SELECT machine.id
	FROM machine
	LEFT JOIN machine_assessment assessment ON assessment."machineId" = machine.id
	WHERE machine.state <> ?
		AND (
			assessment."machineId" IS NULL
			OR assessment."policyVersion" <> ?
			OR assessment."assessedAt" < transaction_timestamp() - (? * interval '1 minute')
			OR assessment."restrictedUntil" BETWEEN assessment."assessedAt" AND transaction_timestamp()
			OR assessment."probationEndsAt" BETWEEN assessment."assessedAt" AND transaction_timestamp()
			OR assessment."qualificationExpiresAt" BETWEEN assessment."assessedAt" AND transaction_timestamp()
		)
	ORDER BY assessment."assessedAt" ASC NULLS FIRST, machine.id ASC
	LIMIT ?`;

@Injectable()
export class MachineReassessmentService {
	private readonly logger = new Logger(MachineReassessmentService.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly assessments: MachineAssessmentService
	) {}

	async reassessDue(): Promise<void> {
		await RequestContext.create(this.entityManager, async () => {
			const rows = await this.entityManager.execute<{ id: string }[]>(
				DUE_MACHINES_SQL,
				[
					MachineState.DECOMMISSIONED,
					MACHINE_TRUST_POLICY.version,
					MACHINE_TRUST_POLICY.reassessmentIntervalMinutes,
					MACHINE_TRUST_POLICY.reassessmentBatchSize,
				]
			);
			for (const { id } of rows) {
				try {
					await this.entityManager.transactional((manager) =>
						this.assessments.assess(manager, id)
					);
				} catch (error) {
					this.logger.error(
						`Failed to reassess machine ${id}: ${errorMessage(error)}`
					);
				}
			}
		});
	}
}
