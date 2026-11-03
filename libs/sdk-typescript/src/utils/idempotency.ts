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

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._~-]{16,128}$/;

export interface IdempotentOperationOptions {
	idempotencyKey?: string;
}

export function resolveIdempotencyKey(explicitKey?: string): string {
	const key = explicitKey ?? globalThis.crypto.randomUUID();
	if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
		throw new SnapflowValidationError(
			'Idempotency key must be 16-128 URL-safe ASCII characters'
		);
	}
	return key;
}
