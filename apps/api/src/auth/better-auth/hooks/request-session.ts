/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type createAuthMiddleware,
	dispatchAuthEndpoint,
	getSession,
} from 'better-auth/api';

export type AuthMiddlewareContext = Parameters<
	Parameters<typeof createAuthMiddleware>[0]
>[0];
export type AuthSession = NonNullable<
	AuthMiddlewareContext['context']['session']
>;

const SESSION_LOOKUP = {
	method: 'GET',
	query: { disableRefresh: true },
	asResponse: false,
} as const;

function isAuthSession(value: unknown): value is AuthSession {
	return (
		typeof value === 'object' &&
		value !== null &&
		'session' in value &&
		'user' in value
	);
}

export async function resolveRequestSession(
	context: AuthMiddlewareContext
): Promise<AuthSession | null> {
	if (context.context.session) return context.context.session;
	const resolved: unknown = await dispatchAuthEndpoint(getSession(), {
		...SESSION_LOOKUP,
		context: context.context,
		headers: context.headers,
	});
	context.context.session = isAuthSession(resolved) ? resolved : null;
	return context.context.session;
}
