/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

const NETWORK_ERROR_MESSAGE =
	'Unable to reach Snapflow. Check your connection and try again.';
const NETWORK_ERROR_MESSAGE_PATTERN =
	/failed to fetch|load failed|networkerror|network request failed|internet connection appears to be offline/i;

export class SnapflowError extends Error {
	public override readonly name: string = 'SnapflowError';
	public readonly code: string | null;
	public readonly retryable: boolean;
	public readonly details: unknown;
	public readonly status: number | null;

	public constructor(
		message: string,
		options: {
			code?: string | null;
			retryable?: boolean;
			details?: unknown;
			cause?: unknown;
			status?: number | null;
		} = {}
	) {
		super(message, { cause: options.cause });
		this.code = options.code ?? null;
		this.retryable = options.retryable ?? false;
		this.details = options.details;
		this.status = options.status ?? null;
	}

	public static fromError(error: Error): SnapflowError {
		if (NETWORK_ERROR_MESSAGE_PATTERN.test(error.message)) {
			return new SnapflowError(NETWORK_ERROR_MESSAGE);
		}

		return new SnapflowError(error.message);
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
			const message = readMessage(error);
			if (message) {
				const code = readProperty(error, 'code');
				return new SnapflowError(SnapflowError.fromString(message).message, {
					code: typeof code === 'string' && code.trim() ? code : null,
					details: error,
				});
			}
		}

		return SnapflowError.fromString('Something went wrong. Please try again.');
	}
}

function readMessage(error: object): string | null {
	for (const property of ['message', 'error_description', 'error'] as const) {
		const value = readProperty(error, property);
		if (typeof value === 'string' && value.trim()) return value;
		if (Array.isArray(value)) {
			const messages = value.filter(
				(item): item is string => typeof item === 'string' && !!item.trim()
			);
			if (messages.length > 0) return messages.join(', ');
		}
	}
	return null;
}

function readProperty(
	value: object,
	property: 'code' | 'error' | 'error_description' | 'message'
): unknown {
	try {
		return Reflect.get(value, property);
	} catch {
		return undefined;
	}
}
