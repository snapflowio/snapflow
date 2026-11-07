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
import { PLATFORM_SERVICE_BILLER } from '../../constants/payment-channel.constants';
import { PlatformServiceBillerService } from '../services/platform-service-biller.service';

// A machine counts for a day when a run finds it in its private pool, so
// runs come often enough that a machine listed for part of a day is seen.
@Injectable()
export class PlatformServiceBillerJob {
	constructor(private readonly biller: PlatformServiceBillerService) {}

	@ScheduledJob(CronExpression.EVERY_10_MINUTES, {
		name: PLATFORM_SERVICE_BILLER.JOB,
		waitForCompletion: true,
	})
	billPlatformServices(): Promise<void> {
		return this.biller.billPlatformServices();
	}
}
