/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ScheduledJob } from '../../../common/decorators/scheduled-job.decorator';
import { DISPOSABLE_EMAIL_REFRESH_JOB } from '../../constants/disposable-email.constants';
import { DisposableEmailService } from '../../services/disposable-email.service';

@Injectable()
export class DisposableEmailRefreshJob implements OnApplicationBootstrap {
	private readonly logger = new Logger(DisposableEmailRefreshJob.name);

	constructor(private readonly disposableEmails: DisposableEmailService) {}

	onApplicationBootstrap(): void {
		void this.refresh();
	}

	@ScheduledJob(DISPOSABLE_EMAIL_REFRESH_JOB.expression, {
		name: DISPOSABLE_EMAIL_REFRESH_JOB.name,
		waitForCompletion: true,
	})
	async refresh(): Promise<void> {
		try {
			await this.disposableEmails.refresh();
		} catch (error) {
			this.logger.warn(
				'Could not refresh the disposable email blocklist; sign-up keeps the bundled list and the last refresh',
				error
			);
		}
	}
}
