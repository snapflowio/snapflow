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
import { NETWORK_BUDGET } from '../../../network-usage/constants/network-usage.constants';
import { NetworkBudgetService } from '../../../network-usage/services/network-budget.service';

@Injectable()
export class NetworkBudgetJob {
	constructor(private readonly networkBudgets: NetworkBudgetService) {}

	@ScheduledJob(CronExpression.EVERY_5_MINUTES, {
		name: NETWORK_BUDGET.JOB,
	})
	enforce(): Promise<void> {
		return this.networkBudgets.enforce();
	}
}
