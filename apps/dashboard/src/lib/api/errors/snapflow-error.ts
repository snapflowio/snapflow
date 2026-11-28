/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	ClientErrorCode,
	catalogEntry,
	type ErrorCatalogAction,
	statusFallbackMessage,
} from './error-catalog.ts';

export const UNREACHABLE_ERROR_CODE = ClientErrorCode.UNREACHABLE;
const NETWORK_ERROR_MESSAGE_PATTERN =
	/failed to fetch|load failed|networkerror|network request failed|internet connection appears to be offline/i;
const RAW_MESSAGE_PATTERN =
	/^(?:[<{[]|(?:HTTP\s*)?\d{3}(?:\s+[A-Za-z]+){0,4}$|[A-Za-z]+(?:Exception|Error)\b:)/;
const MESSAGE_SEPARATOR = ', ';

interface SnapflowErrorOptions {
	code?: string | null;
	retryable?: boolean;
	details?: unknown;
	cause?: unknown;
	status?: number | null;
}

function isRawMessage(message: string): boolean {
	const trimmed = message.trim();
	return trimmed.length === 0 || RAW_MESSAGE_PATTERN.test(trimmed);
}

function userMessage(
	message: string,
	code: string | null,
	status: number | null
): string {
	const entry = catalogEntry(code);
	if (entry?.message) return entry.message;
	if (!isRawMessage(message)) return message;
	return entry?.fallback ?? statusFallbackMessage(status);
}

export class SnapflowError extends Error {
	public override readonly name: string = 'SnapflowError';
	public readonly code: string | null;
	public readonly retryable: boolean;
	public readonly details: unknown;
	public readonly status: number | null;

	public constructor(message: string, options: SnapflowErrorOptions = {}) {
		const code = options.code ?? null;
		const status = options.status ?? null;
		super(userMessage(message, code, status), { cause: options.cause });
		this.code = code;
		this.retryable = options.retryable ?? false;
		this.details = options.details;
		this.status = status;
	}

	public get action(): ErrorCatalogAction | undefined {
		return catalogEntry(this.code)?.action;
	}

	public static unreachable(
		options: { cause?: unknown; status?: number | null } = {}
	): SnapflowError {
		return new SnapflowError('', {
			...options,
			code: ClientErrorCode.UNREACHABLE,
			retryable: true,
		});
	}

	public static fromError(error: Error): SnapflowError {
		if (NETWORK_ERROR_MESSAGE_PATTERN.test(error.message)) {
			return SnapflowError.unreachable({ cause: error });
		}

		return new SnapflowError(error.message, {
			cause: error,
			code: readCode(error),
			status: readStatus(error, 'status'),
		});
	}

	public static fromString(error: string): SnapflowError {
		return SnapflowError.fromError(new Error(error));
	}

	public static fromUnknown(error: unknown): SnapflowError {
		if (error instanceof SnapflowError) {
			return error;
		}

		if (error instanceof Error) {
			return SnapflowError.fromError(error);
		}

		if (typeof error === 'string') {
			return SnapflowError.fromString(error);
		}

		if (error && typeof error === 'object') {
			const message = readMessage(error) ?? '';
			if (NETWORK_ERROR_MESSAGE_PATTERN.test(message)) {
				return SnapflowError.unreachable({ cause: error });
			}
			return new SnapflowError(message, {
				code: readCode(error),
				details: error,
				status: readStatus(error, 'statusCode'),
			});
		}

		return new SnapflowError('');
	}
}

export function isUnreachableError(error: unknown): boolean {
	return (
		error instanceof SnapflowError && error.code === UNREACHABLE_ERROR_CODE
	);
}

function readMessage(error: object): string | null {
	for (const property of ['message', 'error_description', 'error'] as const) {
		const value = readProperty(error, property);
		if (typeof value === 'string' && value.trim()) return value;
		if (Array.isArray(value)) {
			const messages = value.filter(
				(item): item is string => typeof item === 'string' && !!item.trim()
			);
			if (messages.length > 0) return messages.join(MESSAGE_SEPARATOR);
		}
	}
	return null;
}

function readCode(error: object): string | null {
	const code = readProperty(error, 'code');
	return typeof code === 'string' && code.trim() ? code : null;
}

function readStatus(
	error: object,
	property: 'status' | 'statusCode'
): number | null {
	const status = readProperty(error, property);
	return typeof status === 'number' ? status : null;
}

function readProperty(
	value: object,
	property:
		| 'code'
		| 'error'
		| 'error_description'
		| 'message'
		| 'status'
		| 'statusCode'
): unknown {
	try {
		return Reflect.get(value, property);
	} catch {
		return undefined;
	}
}
