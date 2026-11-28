/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { redirect } from '@sveltejs/kit';
import type { AuthSession } from '#lib/api/auth/session.ts';
import { loginHref, normalizeAuthReturnTo } from './auth-return-to.ts';

const TEMPORARY_REDIRECT = 307;

export function requireSession(
	session: AuthSession | null,
	url: URL
): AuthSession {
	if (!session) redirect(TEMPORARY_REDIRECT, loginHref(url));
	return session;
}

export function redirectSignedIn(
	session: AuthSession | null,
	returnTo: string | null
): void {
	if (session) redirect(TEMPORARY_REDIRECT, normalizeAuthReturnTo(returnTo));
}
