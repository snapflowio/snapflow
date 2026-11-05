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
import { SystemExposureLeaseService } from '../../services/exposure/system-exposure-lease.service';

@Injectable()
export class SystemExposureLeaseJob {
	constructor(
		private readonly systemExposureLeaseService: SystemExposureLeaseService
	) {}

	@ScheduledJob(CronExpression.EVERY_30_SECONDS, {
		name: 'expire-system-exposure-leases',
		waitForCompletion: true,
	})
	expireDue(): Promise<void> {
		return this.systemExposureLeaseService.expireDue();
	}
}
