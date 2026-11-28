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
import { DMCA_RESTORATION_JOB } from '../../constants/abuse-report.constants';
import { AbuseCounterNoticeService } from '../../services/abuse-counter-notice.service';

@Injectable()
export class AbuseCounterNoticeJob {
	constructor(private readonly counterNotices: AbuseCounterNoticeService) {}

	@ScheduledJob(DMCA_RESTORATION_JOB.expression, {
		name: DMCA_RESTORATION_JOB.name,
		waitForCompletion: true,
	})
	restore(): Promise<void> {
		return this.counterNotices.restoreDue();
	}
}
