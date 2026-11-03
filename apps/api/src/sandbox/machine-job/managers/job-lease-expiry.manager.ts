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
import {
	errorMessage,
	errorStack,
} from '../../../common/utils/error/error.util';
import { MachineJobNotificationService } from '../../machine/services/machine-job-notification.service';
import { JobLeaseService } from '../services/job-lease.service';
import { JobProjectionService } from '../services/job-projection.service';

@Injectable()
export class JobLeaseExpiryManager {
	private readonly logger = new Logger(JobLeaseExpiryManager.name);

	constructor(
		private readonly entityManager: EntityManager,
		private readonly jobLeaseService: JobLeaseService,
		private readonly jobProjectionService: JobProjectionService,
		private readonly machineNotifications: MachineJobNotificationService
	) {}

	async handleStaleJobs(): Promise<void> {
		await RequestContext.create(this.entityManager, () =>
			this.handleStaleJobsInContext()
		);
	}

	private async handleStaleJobsInContext(): Promise<void> {
		try {
			const expired = await this.jobLeaseService.expireLeases();
			for (const job of expired.requeued) {
				this.machineNotifications.notify(job.machineId, job.id);
			}
			for (const job of expired.failed) {
				await this.jobProjectionService.tryProject(job.id);
			}
			if (expired.requeued.length > 0 || expired.failed.length > 0) {
				this.logger.warn(
					`Expired job leases: ${expired.requeued.length} requeued, ${expired.failed.length} exhausted`
				);
			}
		} catch (error: unknown) {
			this.logger.error(
				`Error handling expired job leases: ${errorMessage(error)}`,
				errorStack(error)
			);
		}
	}
}
