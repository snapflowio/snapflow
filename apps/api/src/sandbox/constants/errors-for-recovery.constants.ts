/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

export const MISSING_RUNTIME_ERROR_REASON =
	'Sandbox runtime is missing on its machine';

const API_RECOVERABLE_SUBSTRINGS: string[] = [
	'timeout while creating',
	'timeout while starting',
	'timeout while pulling',
	'job timed out',
	MISSING_RUNTIME_ERROR_REASON.toLowerCase(),
];

export function isApiRecoverableError(
	errorReason: string | null | undefined
): boolean {
	if (!errorReason) {
		return false;
	}
	const lower = errorReason.toLowerCase();
	return API_RECOVERABLE_SUBSTRINGS.some((s) => lower.includes(s));
}
