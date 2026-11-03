/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type {
	ThrottlerModuleOptions,
	ThrottlerRequest,
	ThrottlerStorage,
} from '@nestjs/throttler';
import type { Request } from 'express';
import { RateLimitThrottler } from '../../infra/rate-limit/constants/rate-limit-policy.constants';
import { SharedBucketThrottlerGuard } from './shared-bucket-throttler.guard';

@Injectable()
export class AnonymousRateLimitGuard extends SharedBucketThrottlerGuard {
	constructor(
		options: ThrottlerModuleOptions,
		storageService: ThrottlerStorage,
		reflector: Reflector
	) {
		super(options, storageService, reflector);
	}

	protected async getTracker(req: Request): Promise<string> {
		const ip = req.ips.length ? req.ips[0] : req.ip;
		return `anonymous:${ip}`;
	}

	async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
		const { throttler } = requestProps;

		if (throttler.name === RateLimitThrottler.ANONYMOUS) {
			return super.handleRequest(requestProps);
		}

		return true;
	}
}
