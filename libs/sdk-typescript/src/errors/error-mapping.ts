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

import { isRecord, optionalString } from '../utils/record.js';
import { createSandboxPlacementError } from './sandbox-placement-error.js';
import {
	createRequestSnapflowError,
	createSnapflowError,
	type SnapflowError,
} from './snapflow-error.js';

const MESSAGE_SEPARATOR = ', ';

function extractErrorCode(body: unknown): string | undefined {
	if (!isRecord(body)) return undefined;
	const { code } = body;
	return optionalString(code);
}

function bodyMessage(body: unknown): string | undefined {
	if (!isRecord(body)) return undefined;
	const { message } = body;
	if (Array.isArray(message)) {
		return message
			.filter((item): item is string => typeof item === 'string')
			.join(MESSAGE_SEPARATOR);
	}
	return optionalString(message);
}

function statusMessage(response: Response): string {
	const reason = response.statusText ? ` (${response.statusText})` : '';
	return `The Snapflow API request failed with status ${response.status}${reason}`;
}

function createResponseSnapflowError(
	body: unknown,
	response: Response
): SnapflowError {
	const message = bodyMessage(body) || statusMessage(response);
	const errorCode = extractErrorCode(body);
	const placementError = isRecord(body)
		? createSandboxPlacementError(body, errorCode, message, response)
		: undefined;
	return (
		placementError ??
		createSnapflowError(message, response.status, response.headers, errorCode, {
			cause: body,
		})
	);
}

export function toSnapflowError(
	error: unknown,
	response: Response | undefined
): SnapflowError {
	if (response && !response.ok) {
		return createResponseSnapflowError(error, response);
	}
	return createRequestSnapflowError(error);
}
