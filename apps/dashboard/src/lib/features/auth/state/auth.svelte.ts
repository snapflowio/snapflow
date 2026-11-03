/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type CreateQueryResult,
	createQuery,
	type QueryClient,
	useQueryClient,
} from '@tanstack/svelte-query';
import { watch } from 'runed';
import { createContext } from 'svelte';
import { fromStore } from 'svelte/store';
import {
	activeOrganizationStore,
	organizationsStore,
} from '#lib/api/auth/organization.ts';
import {
	isOrganizationScopedQuery,
	isUserScopedQuery,
} from '#lib/api/auth/query-scope.ts';
import { AUTH_ROLE, hasAuthRole } from '#lib/api/auth/role.ts';
import {
	AUTH_SESSION_DEPENDENCY,
	type AuthSession,
	authQueryKeys,
	listenSessionChanged,
	refreshSession,
	sessionQueryOptions,
} from '#lib/api/auth/session.ts';
import { setActiveOrganizationContext } from '#lib/api/client/organization-context.ts';
import { invalidate } from '$app/navigation';

export class AuthState {
	readonly #queryClient: QueryClient;
	readonly #session: CreateQueryResult<AuthSession | null>;
	readonly #organizations = fromStore(organizationsStore());
	readonly #activeOrganization = fromStore(activeOrganizationStore());
	readonly #isPending = $derived.by(() => this.#session.isPending);
	readonly session = $derived.by(() => this.#session.data ?? null);
	readonly user = $derived(this.session?.user ?? null);
	readonly isAdmin = $derived(hasAuthRole(this.user?.role, AUTH_ROLE.ADMIN));
	readonly activeOrganizationId = $derived(
		this.session?.session.activeOrganizationId ?? null
	);
	readonly activeOrganization = $derived(
		this.#activeOrganization.current.data ?? null
	);
	readonly organizations = $derived(this.#organizations.current.data ?? []);
	readonly #userId = $derived(this.user?.id ?? null);

	constructor(queryClient: QueryClient = useQueryClient()) {
		this.#queryClient = queryClient;
		this.#session = createQuery(
			() => sessionQueryOptions(),
			() => queryClient
		);
		$effect(() => listenSessionChanged(this.#markSessionChanged));

		watch(
			() => this.#userId,
			() => {
				if (this.#isPending) return;
				this.#queryClient.removeQueries({ predicate: isUserScopedQuery });
				void invalidate(AUTH_SESSION_DEPENDENCY);
			},
			{ lazy: true }
		);

		watch(
			() => this.activeOrganizationId,
			(organizationId, previousOrganizationId) => {
				if (this.#isPending) return;
				setActiveOrganizationContext(organizationId);
				if (previousOrganizationId === undefined) return;
				void this.#queryClient.resetQueries({
					predicate: isOrganizationScopedQuery,
				});
			}
		);
	}

	refetch = (): Promise<void> => refreshSession(this.#queryClient);

	refetchOrganizations = async (): Promise<void> => {
		await this.#organizations.current.refetch();
	};

	#markSessionChanged = (): void => {
		void this.#queryClient.invalidateQueries(
			{ queryKey: authQueryKeys.session() },
			{ cancelRefetch: false }
		);
	};
}

export const [getAuth, setAuth] = createContext<AuthState>();
