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

/*
 * Copyright 2025 Snapflow
 * SPDX-License-Identifier: Apache-2.0
 */

export class SnapflowError extends Error {
	public override readonly cause?: Error;

	constructor(message: string, cause?: Error) {
		super(message);
		this.name = 'SnapflowError';
		this.cause = cause;

		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, SnapflowError);
		}
	}
}

export class SnapflowNotFoundError extends SnapflowError {
	constructor(message: string, cause?: Error) {
		super(message, cause);
		this.name = 'SnapflowNotFoundError';

		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, SnapflowNotFoundError);
		}
	}
}

export class SnapflowRateLimitError extends SnapflowError {
	constructor(message: string, cause?: Error) {
		super(message, cause);
		this.name = 'SnapflowRateLimitError';

		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, SnapflowRateLimitError);
		}
	}
}
