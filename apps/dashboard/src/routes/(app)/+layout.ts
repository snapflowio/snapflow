/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	AUTH_SESSION_DEPENDENCY,
	sessionQueryOptions,
} from '#lib/api/auth/session.ts';
import { publicConfigQueryOptions } from '#lib/api/public-config.ts';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ depends, parent }) => {
	depends(AUTH_SESSION_DEPENDENCY);
	const { queryClient } = await parent();
	const [, session] = await Promise.all([
		queryClient.query(publicConfigQueryOptions()),
		queryClient.query(sessionQueryOptions()),
	]);
	return { session };
};
