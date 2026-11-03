/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { AccountDeletionError } from '#lib/api/auth/account.ts';

const SESSION_EXPIRED_CODE = 'SESSION_EXPIRED';
const SESSION_EXPIRED_MESSAGE =
	'Sign out and sign back in before deleting your account';
const FALLBACK_MESSAGE = 'Failed to delete account';

export function accountDeletionErrorMessage(
	error: AccountDeletionError
): string {
	if (error.code === SESSION_EXPIRED_CODE) return SESSION_EXPIRED_MESSAGE;
	return error.message || FALLBACK_MESSAGE;
}
