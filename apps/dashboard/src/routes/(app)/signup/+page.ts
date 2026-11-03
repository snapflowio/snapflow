/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { redirectSignedIn } from '#lib/features/auth/lib/auth-redirects.ts';
import {
	AUTH_RETURN_TO_PARAM,
	normalizeAuthReturnTo,
} from '#lib/features/auth/lib/auth-return-to.ts';
import { optionalSearchString } from '#lib/routing/router-search.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, url }) => {
	const returnTo = optionalSearchString(url.searchParams, AUTH_RETURN_TO_PARAM);
	const { session } = await parent();
	redirectSignedIn(session, returnTo ?? null);
	return {
		returnTo: returnTo ? normalizeAuthReturnTo(returnTo) : null,
	};
};
