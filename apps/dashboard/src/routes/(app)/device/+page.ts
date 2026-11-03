/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { DEVICE_USER_CODE_PARAM } from '#lib/api/auth/device.ts';
import { requireSession } from '#lib/features/auth/lib/auth-redirects.ts';
import { optionalSearchString } from '#lib/routing/router-search.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, url }) => {
	const { session } = await parent();
	requireSession(session, url);
	return {
		userCode: optionalSearchString(url.searchParams, DEVICE_USER_CODE_PARAM),
	};
};
