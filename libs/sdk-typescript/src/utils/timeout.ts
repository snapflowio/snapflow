/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { SnapflowValidationError } from '../errors/snapflow-error.js';

export const MILLISECONDS_PER_SECOND = 1000;
export const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
export const MILLISECONDS_PER_MINUTE =
	SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
export const MILLISECONDS_PER_HOUR = MINUTES_PER_HOUR * MILLISECONDS_PER_MINUTE;

export const DEFAULT_SANDBOX_TIMEOUT_SECONDS = 60;

const MINIMUM_REMAINING_TIMEOUT_SECONDS = 0.001;

export function toMilliseconds(seconds: number): number {
	return Math.round(seconds * MILLISECONDS_PER_SECOND);
}

export function assertNonNegativeTimeout(timeout: number): void {
	if (timeout < 0) {
		throw new SnapflowValidationError('Timeout must be a non-negative number');
	}
}

export function remainingTimeoutSeconds(
	timeout: number,
	startTime: number
): number {
	if (timeout === 0) return 0;
	return Math.max(
		MINIMUM_REMAINING_TIMEOUT_SECONDS,
		timeout - (Date.now() - startTime) / MILLISECONDS_PER_SECOND
	);
}

export const DEFAULT_FILE_TRANSFER_TIMEOUT_SECONDS = 1800;

export class Deadline {
	private constructor(private readonly expiresAt: number | undefined) {}

	static after(timeoutSeconds: number): Deadline {
		return new Deadline(
			timeoutSeconds === 0
				? undefined
				: Date.now() + toMilliseconds(timeoutSeconds)
		);
	}

	remainingMilliseconds(): number | undefined {
		return this.expiresAt === undefined
			? undefined
			: Math.max(0, this.expiresAt - Date.now());
	}

	remainingSeconds(): number | undefined {
		const remaining = this.remainingMilliseconds();
		return remaining === undefined
			? undefined
			: remaining / MILLISECONDS_PER_SECOND;
	}

	isExpired(): boolean {
		return this.remainingMilliseconds() === 0;
	}
}
