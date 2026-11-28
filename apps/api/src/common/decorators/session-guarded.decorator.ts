/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	applyDecorators,
	type CanActivate,
	SetMetadata,
	type Type,
	UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { RateLimitThrottler } from '../../infra/rate-limit/constants/rate-limit-policy.constants';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { SESSION_RATE_LIMITED_KEY } from './throttler-scope.decorator';

export const SessionGuarded = (sessionGuard: Type<CanActivate>) =>
	applyDecorators(
		SetMetadata(SESSION_RATE_LIMITED_KEY, true),
		SkipThrottle({ [RateLimitThrottler.ANONYMOUS]: true }),
		UseGuards(sessionGuard, RateLimitGuard)
	);
