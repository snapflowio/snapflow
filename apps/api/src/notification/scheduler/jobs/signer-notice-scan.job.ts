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
import { SIGNER_NOTICE_SCAN } from '../../constants/notice.constants';
import { SignerNoticeScanService } from '../../services/signer-notice-scan.service';

@Injectable()
export class SignerNoticeScanJob {
	constructor(private readonly signerNotices: SignerNoticeScanService) {}

	@ScheduledJob(SIGNER_NOTICE_SCAN.expression, {
		name: SIGNER_NOTICE_SCAN.jobName,
		waitForCompletion: true,
	})
	scan(): Promise<void> {
		return this.signerNotices.scan();
	}
}
