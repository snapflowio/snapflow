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

import type { SandboxState } from '@snapflow/api-client';
import { HttpStatus, nextStepFor, SdkErrorCode } from './error-catalog.js';

export type ResponseHeaders = Headers;

export interface SnapflowErrorOptions {
	nextStep?: string;
	cause?: unknown;
}

export class SnapflowError extends Error {
	public statusCode?: number;
	public errorCode?: string;
	public headers?: ResponseHeaders;
	public readonly nextStep?: string;

	constructor(
		message: string,
		statusCode?: number,
		headers?: ResponseHeaders,
		errorCode?: string,
		options: SnapflowErrorOptions = {}
	) {
		super(message, { cause: options.cause });
		this.name = new.target.name;
		this.statusCode = statusCode;
		this.headers = headers;
		this.errorCode = errorCode;
		this.nextStep = options.nextStep ?? nextStepFor(errorCode, statusCode);
	}

	public get code(): string | undefined {
		return this.errorCode;
	}

	public get status(): number | undefined {
		return this.statusCode;
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

export class SnapflowSandboxTimeoutError extends SnapflowTimeoutError {
	public readonly state?: SandboxState;

	constructor(message: string, state?: SandboxState) {
		super(
			state === undefined ? message : `${message}; it is still ${state}`,
			undefined,
			undefined,
			SdkErrorCode.SANDBOX_STATE_TIMEOUT
		);
		this.state = state;
	}
}

const STATUS_CODE_TO_ERROR: Readonly<Record<number, typeof SnapflowError>> = {
	[HttpStatus.BAD_REQUEST]: SnapflowValidationError,
	[HttpStatus.UNAUTHORIZED]: SnapflowAuthenticationError,
	[HttpStatus.FORBIDDEN]: SnapflowAuthorizationError,
	[HttpStatus.NOT_FOUND]: SnapflowNotFoundError,
	[HttpStatus.REQUEST_TIMEOUT]: SnapflowTimeoutError,
	[HttpStatus.CONFLICT]: SnapflowConflictError,
	[HttpStatus.TOO_MANY_REQUESTS]: SnapflowRateLimitError,
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
	errorCode?: string,
	options?: SnapflowErrorOptions
): SnapflowError {
	const ErrorClass = errorClassFromStatusCode(statusCode);
	return new ErrorClass(message, statusCode, headers, errorCode, options);
}

const TIMEOUT_ERROR_NAME = 'TimeoutError';
const TIMEOUT_MESSAGE = 'The request to the Snapflow API timed out';
const CONNECTION_MESSAGE = 'Could not reach Snapflow';

export function createRequestSnapflowError(error: unknown): SnapflowError {
	if (error instanceof SnapflowError) {
		return error;
	}
	if (error instanceof Error && error.name === TIMEOUT_ERROR_NAME) {
		return new SnapflowTimeoutError(
			TIMEOUT_MESSAGE,
			undefined,
			undefined,
			SdkErrorCode.REQUEST_TIMEOUT,
			{ cause: error }
		);
	}
	const detail = error instanceof Error ? error.message : String(error);
	return new SnapflowConnectionError(
		`${CONNECTION_MESSAGE}: ${detail}`,
		undefined,
		undefined,
		SdkErrorCode.CONNECTION_FAILED,
		{ cause: error }
	);
}
