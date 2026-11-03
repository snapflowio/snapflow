/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SnapflowError } from '#lib/api/errors/snapflow-error.ts';
import { Path } from '#lib/routing/paths.ts';
import { resolve } from '$app/paths';

const ADMIN_MFA_REQUIRED_CODE = 'ADMIN_MFA_REQUIRED';

export const SECURITY_SETTINGS_LINK = {
	label: 'Open security settings',
	to: resolve(Path.ACCOUNT),
} as const;

export function isAdminMfaRequired(error: unknown): boolean {
	return SnapflowError.fromUnknown(error).code === ADMIN_MFA_REQUIRED_CODE;
}
