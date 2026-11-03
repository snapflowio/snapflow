/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

export abstract class SharedBucketThrottlerGuard extends ThrottlerGuard {
	protected generateKey(
		// biome-ignore lint/correctness/noUnusedFunctionParameters: ThrottlerGuard fixes this signature and the bucket is shared by every route
		context: ExecutionContext,
		tracker: string,
		throttlerName: string
	): string {
		return `${throttlerName}-${tracker}`;
	}
}
