/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { BadRequestException } from '@nestjs/common';
import {
	IDEMPOTENCY_LIMITS,
	IDEMPOTENCY_PROBLEM_CODE,
} from '../constants/idempotency.constants';

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._~:+-]+$/;

export function parseIdempotencyKey(value: unknown): string {
	if (typeof value !== 'string' || value.length === 0) {
		throw new BadRequestException({
			code: IDEMPOTENCY_PROBLEM_CODE.KEY_REQUIRED,
			message: 'Idempotency-Key is required for this mutation',
		});
	}
	if (
		value.length < IDEMPOTENCY_LIMITS.KEY_MIN_LENGTH ||
		value.length > IDEMPOTENCY_LIMITS.KEY_MAX_LENGTH ||
		!IDEMPOTENCY_KEY_PATTERN.test(value)
	) {
		throw new BadRequestException({
			code: IDEMPOTENCY_PROBLEM_CODE.KEY_INVALID,
			message: 'Idempotency-Key must be 16-128 URL-safe ASCII characters',
		});
	}
	return value;
}
