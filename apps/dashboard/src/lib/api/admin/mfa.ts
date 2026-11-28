/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { ApiErrorCode } from '@snapflow/api-client';
import { hasErrorCode } from '#lib/api/errors/api-error-details.ts';
import { Path } from '#lib/routing/paths.ts';
import { resolve } from '$app/paths';

export const SECURITY_SETTINGS_LINK = {
	label: 'Open security settings',
	to: resolve(Path.ACCOUNT_SECURITY),
} as const;

export function isAdminMfaRequired(error: unknown): boolean {
	return hasErrorCode(error, ApiErrorCode.AdminMfaRequired);
}
