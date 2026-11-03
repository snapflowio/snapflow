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
import { NETWORK_USAGE_RATING } from '../../usage/constants/network-usage.constants';
import { NetworkUsageRatingService } from '../../usage/services/network-usage-rating.service';

@Injectable()
export class NetworkUsageRatingJob {
	constructor(private readonly networkUsageRating: NetworkUsageRatingService) {}

	@ScheduledJob(CronExpression.EVERY_5_MINUTES, {
		name: NETWORK_USAGE_RATING.JOB,
		waitForCompletion: true,
	})
	rateClosedPeriods(): Promise<void> {
		return this.networkUsageRating.rateClosedPeriods();
	}
}
