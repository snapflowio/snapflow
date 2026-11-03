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
import { NETWORK_METER_AUDIT } from '../../qualification/constants/network-meter-audit.constants';
import { NetworkMeterAuditService } from '../../qualification/services/network-meter-audit.service';

@Injectable()
export class NetworkMeterAuditJob {
	constructor(private readonly networkMeterAudit: NetworkMeterAuditService) {}

	@ScheduledJob(CronExpression.EVERY_DAY_AT_4AM, {
		name: NETWORK_METER_AUDIT.JOB,
		waitForCompletion: true,
	})
	audit(): Promise<void> {
		return this.networkMeterAudit.audit();
	}
}
