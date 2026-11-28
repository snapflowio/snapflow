/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { ApiError } from '@snapflow/api-client';

function isApiError(error: unknown): error is Pick<ApiError, 'message'> {
	return (
		typeof error === 'object' &&
		error !== null &&
		'message' in error &&
		typeof error.message === 'string'
	);
}

export function apiErrorMessage(error: unknown, fallback: string): string {
	return isApiError(error) && error.message ? error.message : fallback;
}
