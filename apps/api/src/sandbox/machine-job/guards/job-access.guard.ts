/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	CanActivate,
	ExecutionContext,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { isMachineAuthContext } from '../../../common/types/machine-auth-context.types';
import { getAuthContext } from '../../../common/utils/auth-context.util';
import { JobService } from '../services/job.service';

@Injectable()
export class JobAccessGuard implements CanActivate {
	constructor(private readonly jobService: JobService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context
			.switchToHttp()
			.getRequest<Request<{ jobId: string }>>();
		const authContext = getAuthContext(context, isMachineAuthContext);
		const job = await this.jobService.findOne(request.params.jobId);
		if (job?.machineId !== authContext.machineId) {
			throw new NotFoundException('Job not found');
		}
		return true;
	}
}
