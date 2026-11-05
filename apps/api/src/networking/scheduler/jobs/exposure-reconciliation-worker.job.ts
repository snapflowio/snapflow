/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { ScheduledJob } from '../../../common/decorators/scheduled-job.decorator';
import { ExposureReconciliationWorkerService } from '../../services/exposure/exposure-reconciliation-worker.service';

@Injectable()
export class ExposureReconciliationWorkerJob {
	constructor(
		private readonly exposureReconciliationWorkerService: ExposureReconciliationWorkerService
	) {}

	@ScheduledJob(CronExpression.EVERY_5_SECONDS, {
		name: 'reconcile-network-exposures',
		waitForCompletion: true,
	})
	run(): Promise<void> {
		return this.exposureReconciliationWorkerService.run();
	}
}
