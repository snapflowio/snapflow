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

export const SIGNUP_MODE_PARAM = 'mode';

const SIGNUP_MODE_LANDING = {
	host: Path.MACHINES_ADD,
} as const;

function isSignupMode(
	value: string
): value is keyof typeof SIGNUP_MODE_LANDING {
	return Object.hasOwn(SIGNUP_MODE_LANDING, value);
}

export function signupModeReturnTo(params: URLSearchParams): string | null {
	const mode = params.get(SIGNUP_MODE_PARAM);
	return mode && isSignupMode(mode) ? resolve(SIGNUP_MODE_LANDING[mode]) : null;
}
