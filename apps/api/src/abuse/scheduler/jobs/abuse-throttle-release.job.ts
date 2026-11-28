/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import { ScheduledJob } from '../../../common/decorators/scheduled-job.decorator';
import { ABUSE_THROTTLE_RELEASE_JOB } from '../../constants/abuse.constants';
import { AbuseCaseService } from '../../services/abuse-case.service';

@Injectable()
export class AbuseThrottleReleaseJob {
	constructor(private readonly cases: AbuseCaseService) {}

	@ScheduledJob(ABUSE_THROTTLE_RELEASE_JOB.expression, {
		name: ABUSE_THROTTLE_RELEASE_JOB.name,
		waitForCompletion: true,
	})
	release(): Promise<void> {
		return this.cases.releaseQuietCases();
	}
}
