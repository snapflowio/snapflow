/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { isAdminMfaRequired } from '#lib/api/admin/mfa.ts';
import { SnapflowError } from '#lib/api/errors/snapflow-error.ts';

const NOT_FOUND_STATUS = 404;

export function adminLoadErrorMessage(
	error: unknown,
	resource: string
): string {
	return isAdminMfaRequired(error)
		? `Verify your identity to view ${resource}`
		: `Couldn't load ${resource}`;
}

export function adminTableError(
	error: unknown,
	resource: string
): string | undefined {
	return error ? adminLoadErrorMessage(error, resource) : undefined;
}

export function isAdminNotFound(error: unknown): boolean {
	return error instanceof SnapflowError && error.status === NOT_FOUND_STATUS;
}
