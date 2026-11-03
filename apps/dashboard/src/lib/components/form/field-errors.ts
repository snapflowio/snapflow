/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

function errorMessage(error: unknown): string | undefined {
	if (typeof error === 'string') {
		return error;
	}

	if (error instanceof Error) {
		return error.message;
	}

	if (error && typeof error === 'object' && 'message' in error) {
		const { message } = error;
		return typeof message === 'string' ? message : undefined;
	}

	return undefined;
}

export function firstFieldError(
	errors: readonly unknown[]
): string | undefined {
	for (const error of errors) {
		if (Array.isArray(error)) {
			const nestedMessage = firstFieldError(error);
			if (nestedMessage) {
				return nestedMessage;
			}
			continue;
		}

		const message = errorMessage(error);
		if (message) {
			return message;
		}
	}

	return undefined;
}
