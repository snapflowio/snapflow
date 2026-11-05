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
import { ExposureDnsReconcilerService } from '../../services/exposure/exposure-dns-reconciler.service';

@Injectable()
export class ExposureDnsReconcilerJob {
	constructor(
		private readonly exposureDnsReconcilerService: ExposureDnsReconcilerService
	) {}

	@ScheduledJob(CronExpression.EVERY_5_SECONDS, {
		name: 'reconcile-exposure-dns-activation',
		waitForCompletion: true,
	})
	reconcileReady(): Promise<void> {
		return this.exposureDnsReconcilerService.reconcileReady();
	}
}
