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

export type ResponseHeaders = Headers;

export class SnapflowError extends Error {
	public statusCode?: number;
	public errorCode?: string;
	public headers?: ResponseHeaders;

	constructor(
		message: string,
		statusCode?: number,
		headers?: ResponseHeaders,
		errorCode?: string
	) {
		super(message);
		this.name = new.target.name;
		this.statusCode = statusCode;
		this.headers = headers;
		this.errorCode = errorCode;
	}
}

export class SnapflowNotFoundError extends SnapflowError {}

export class SnapflowRateLimitError extends SnapflowError {}

export class SnapflowAuthenticationError extends SnapflowError {}

export class SnapflowAuthorizationError extends SnapflowError {}

export class SnapflowConflictError extends SnapflowError {}

export class SnapflowValidationError extends SnapflowError {}

export class SnapflowTimeoutError extends SnapflowError {}

export class SnapflowConnectionError extends SnapflowError {}

const STATUS_CODE_TO_ERROR: Record<number, typeof SnapflowError> = {
	400: SnapflowValidationError,
	401: SnapflowAuthenticationError,
	403: SnapflowAuthorizationError,
	404: SnapflowNotFoundError,
	409: SnapflowConflictError,
	429: SnapflowRateLimitError,
};

function errorClassFromStatusCode(statusCode?: number): typeof SnapflowError {
	if (statusCode === undefined) {
		return SnapflowError;
	}

	return STATUS_CODE_TO_ERROR[statusCode] || SnapflowError;
}

export function createSnapflowError(
	message: string,
	statusCode?: number,
	headers?: ResponseHeaders,
	errorCode?: string
): SnapflowError {
	const ErrorClass = errorClassFromStatusCode(statusCode);
	return new ErrorClass(message, statusCode, headers, errorCode);
}

const TIMEOUT_ERROR_NAME = 'TimeoutError';
const TIMEOUT_MESSAGE = 'Operation timed out';

export function createRequestSnapflowError(error: unknown): SnapflowError {
	if (error instanceof SnapflowError) {
		return error;
	}
	if (error instanceof Error && error.name === TIMEOUT_ERROR_NAME) {
		return new SnapflowTimeoutError(TIMEOUT_MESSAGE);
	}
	return new SnapflowConnectionError(
		error instanceof Error ? error.message : String(error)
	);
}
