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
import { UnobservedCreateReassignmentService } from '../../instance/services/admission/unobserved-create-reassignment.service';

@Injectable()
export class UnobservedCreateReassignmentJob {
	constructor(
		private readonly unobservedCreateReassignmentService: UnobservedCreateReassignmentService
	) {}

	@ScheduledJob(CronExpression.EVERY_10_SECONDS, {
		name: 'reassign-unobserved-creates',
		waitForCompletion: true,
	})
	reassignDue(): Promise<void> {
		return this.unobservedCreateReassignmentService.reassignDue();
	}
}
