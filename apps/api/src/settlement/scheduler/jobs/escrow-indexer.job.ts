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
import { ESCROW_INDEXER } from '../../constants/escrow.constants';
import { EscrowIndexerService } from '../services/escrow-indexer.service';

@Injectable()
export class EscrowIndexerJob {
	constructor(private readonly indexer: EscrowIndexerService) {}

	@ScheduledJob(CronExpression.EVERY_5_SECONDS, {
		name: ESCROW_INDEXER.JOB,
		waitForCompletion: true,
	})
	indexConfirmedEvents(): Promise<void> {
		return this.indexer.indexConfirmedEvents();
	}
}
