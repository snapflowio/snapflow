/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { type QueryClient, queryOptions } from '@tanstack/svelte-query';
import { authClient } from './client.ts';
import { unwrapAuthResult } from './result.ts';

const AUTH_QUERY_ROOT = 'auth';
const SESSION_STALE_TIME_MILLISECONDS = 30_000;
const SESSION_SIGNAL = '$sessionSignal';

export const AUTH_SESSION_DEPENDENCY = 'auth:session';

export type AuthSession = typeof authClient.$Infer.Session;

export const authQueryKeys = {
	session: () => [AUTH_QUERY_ROOT, 'session'] as const,
};

export function sessionQueryOptions() {
	return queryOptions({
		queryKey: authQueryKeys.session(),
		queryFn: async () => unwrapAuthResult(await authClient.getSession()),
		staleTime: SESSION_STALE_TIME_MILLISECONDS,
	});
}

export function refreshSession(queryClient: QueryClient): Promise<void> {
	return queryClient.invalidateQueries({ queryKey: authQueryKeys.session() });
}

export const SIGN_OUT_FAILED_MESSAGE = 'Failed to sign out';

export async function signOut(queryClient: QueryClient): Promise<void> {
	try {
		unwrapAuthResult(await authClient.signOut());
	} finally {
		await refreshSession(queryClient);
	}
}

export function notifySessionChanged(): void {
	authClient.$store.notify(SESSION_SIGNAL);
}

export function listenSessionChanged(listener: () => void): () => void {
	const signal = authClient.$store.atoms[SESSION_SIGNAL];
	if (!signal) throw new Error('The auth client has no session signal.');
	return signal.listen(listener);
}
