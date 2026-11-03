/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

const MESSAGE_SEPARATOR = ', ';

export interface NormalizedHttpExceptionResponse {
	details: Record<string, unknown>;
	message: string;
}

export function normalizeHttpExceptionResponse(
	response: string | object,
	fallbackMessage: string
): NormalizedHttpExceptionResponse {
	if (typeof response === 'string') {
		return { details: {}, message: response };
	}
	const details = isRecord(response) ? response : {};
	const message =
		responseMessage(details.message) ??
		(domainErrorMessage(details.code) || fallbackMessage);
	return { details, message };
}

function responseMessage(value: unknown): string | null {
	if (Array.isArray(value)) return value.join(MESSAGE_SEPARATOR);
	return typeof value === 'string' ? value : null;
}

function domainErrorMessage(code: unknown): string {
	if (typeof code !== 'string' || code.length === 0) return '';
	const words = code.replaceAll('_', ' ');
	return `${words[0].toUpperCase()}${words.slice(1)}`;
}

function isRecord(value: object): value is Record<string, unknown> {
	return !Array.isArray(value);
}
