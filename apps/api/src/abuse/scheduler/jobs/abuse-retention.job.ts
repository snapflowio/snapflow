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
import {
	ABUSE_EVIDENCE_CLEANUP_JOB,
	ABUSE_HOSTNAME_RELEASE_JOB,
} from '../../constants/abuse-report.constants';
import { AbuseRetentionService } from '../../services/abuse-retention.service';

@Injectable()
export class AbuseRetentionJob {
	constructor(private readonly retention: AbuseRetentionService) {}

	@ScheduledJob(ABUSE_HOSTNAME_RELEASE_JOB.expression, {
		name: ABUSE_HOSTNAME_RELEASE_JOB.name,
		waitForCompletion: true,
	})
	releaseHostnames(): Promise<void> {
		return this.retention.releaseHostnames();
	}

	@ScheduledJob(ABUSE_EVIDENCE_CLEANUP_JOB.expression, {
		name: ABUSE_EVIDENCE_CLEANUP_JOB.name,
		waitForCompletion: true,
	})
	expire(): Promise<void> {
		return this.retention.expire();
	}
}
