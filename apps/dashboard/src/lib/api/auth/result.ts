/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SnapflowError } from '#lib/api/errors/snapflow-error.ts';

interface AuthClientError {
	code?: string;
	error_description?: string;
	message?: string;
}

type AuthClientResult<TData> =
	| { data: TData; error: null }
	| { data: null; error: AuthClientError };

export function unwrapAuthResult<TData>(
	result: AuthClientResult<TData>
): TData {
	if (result.error === null) return result.data;
	throw SnapflowError.fromUnknown(result.error);
}
