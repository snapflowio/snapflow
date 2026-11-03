/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	isAdminMfaRequired,
	SECURITY_SETTINGS_LINK,
} from '#lib/api/admin/mfa.ts';
import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import { SnapflowError } from './snapflow-error.ts';

export function showApiError(error: unknown, message: string) {
	const apiError = SnapflowError.fromUnknown(error);

	toast.error(message, {
		description: apiError.message,
		action: isAdminMfaRequired(apiError) ? SECURITY_SETTINGS_LINK : undefined,
	});
}
