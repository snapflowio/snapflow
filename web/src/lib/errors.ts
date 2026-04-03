/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SnapflowError } from '@/api/errors';
import { toast } from '@/components/ui';

export function handleApiError(error: unknown, message: string) {
	const isSnapflowError = error instanceof SnapflowError;
	const description = isSnapflowError
		? error.message
		: 'Something went wrong. Please try again later.';

	toast.error(`${message}: ${description}`);

	if (!isSnapflowError) console.error(message, error);
}
