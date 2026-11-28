/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Path } from '#lib/routing/paths.ts';
import { resolve } from '$app/paths';
import {
	AUTH_RETURN_TO_PARAM,
	normalizeAuthReturnTo,
} from './auth-return-to.ts';

export function signupPasskeyHref(returnTo: string | null): string {
	const search = new URLSearchParams({
		[AUTH_RETURN_TO_PARAM]: normalizeAuthReturnTo(returnTo),
	});
	return `${resolve(Path.SIGNUP_PASSKEY)}?${search}`;
}
