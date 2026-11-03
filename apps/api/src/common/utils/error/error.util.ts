/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export function toError(cause: unknown): Error {
	if (cause instanceof Error) return cause;
	if (typeof cause === 'string') return new Error(cause);

	try {
		return new Error(JSON.stringify(cause));
	} catch {
		return new Error(String(cause));
	}
}

export function errorMessage(cause: unknown): string {
	return toError(cause).message;
}

export function errorStack(cause: unknown): string | undefined {
	return toError(cause).stack;
}

export function errorDetail(cause: unknown): string | undefined {
	if (!isRecord(cause)) return undefined;
	return typeof cause.detail === 'string' ? cause.detail : undefined;
}

export function errorConstraint(cause: unknown): string | undefined {
	if (!isRecord(cause)) return undefined;
	return typeof cause.constraint === 'string' ? cause.constraint : undefined;
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
	return typeof value === 'object' && value !== null;
}
