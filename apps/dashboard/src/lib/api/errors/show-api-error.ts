/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { toast } from '#lib/components/ui/toast/toasts.svelte.ts';
import { goto } from '$app/navigation';
import { errorActionHref } from './error-catalog.ts';
import { SnapflowError } from './snapflow-error.ts';

type ToastAction = NonNullable<
	NonNullable<Parameters<typeof toast.error>[1]>['action']
>;

function apiErrorToastAction(error: unknown): ToastAction | undefined {
	const action = SnapflowError.fromUnknown(error).action;
	return (
		action && {
			label: action.label,
			onClick: () => void goto(errorActionHref(action)),
		}
	);
}

export function showApiError(error: unknown, message: string) {
	const apiError = SnapflowError.fromUnknown(error);

	toast.error(message, {
		description: apiError.message,
		action: apiErrorToastAction(apiError),
	});
}
