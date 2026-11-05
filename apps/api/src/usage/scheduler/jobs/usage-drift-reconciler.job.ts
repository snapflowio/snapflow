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
import { USAGE_JOB } from '../../constants/usage-lifecycle.constants';
import { UsageDriftReconcilerService } from '../../services/usage-drift-reconciler.service';

@Injectable()
export class UsageDriftReconcilerJob {
	constructor(
		private readonly usageDriftReconcilerService: UsageDriftReconcilerService
	) {}

	@ScheduledJob(CronExpression.EVERY_MINUTE, {
		name: USAGE_JOB.LIFECYCLE_RECONCILIATION,
		waitForCompletion: true,
	})
	reconcileUsageLifecycle(): Promise<void> {
		return this.usageDriftReconcilerService.reconcileUsageLifecycle();
	}
}
