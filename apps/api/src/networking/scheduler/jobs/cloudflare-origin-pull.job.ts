/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import { ORIGIN_PULL_RECONCILER } from '../../../cloudflare/constants/origin-pull.constants';
import { CloudflareOriginPullService } from '../../../cloudflare/services/cloudflare-origin-pull.service';
import { ScheduledJob } from '../../../common/decorators/scheduled-job.decorator';

@Injectable()
export class CloudflareOriginPullJob {
	constructor(private readonly originPull: CloudflareOriginPullService) {}

	@ScheduledJob(ORIGIN_PULL_RECONCILER.expression, {
		name: ORIGIN_PULL_RECONCILER.name,
	})
	reconcile(): Promise<void> {
		return this.originPull.reconcile();
	}
}
