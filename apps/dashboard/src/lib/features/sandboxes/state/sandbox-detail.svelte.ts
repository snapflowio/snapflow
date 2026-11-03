/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import type { Sandbox } from '@snapflow/api-client';
import {
	createQuery,
	useIsMutating,
	useQueryClient,
} from '@tanstack/svelte-query';
import { createContext } from 'svelte';
import {
	sandboxActionMutationFilters,
	sandboxChangeQueryKeys,
	sandboxQueryOptions,
} from '#lib/api/sandboxes/sandboxes.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';

export class SandboxDetail {
	readonly query;
	readonly #sandboxId: () => string;
	readonly #queryClient = useQueryClient();
	readonly #runningActions = useIsMutating(sandboxActionMutationFilters);
	readonly #permission = getOrganizationPermission();
	readonly canWrite = $derived(this.#permission.can({ sandboxes: ['write'] }));
	readonly canDelete = $derived(
		this.#permission.can({ sandboxes: ['delete'] })
	);

	constructor(sandboxId: () => string) {
		this.#sandboxId = sandboxId;
		this.query = createQuery(() => sandboxQueryOptions(sandboxId()));
	}

	get sandboxId(): string {
		return this.#sandboxId();
	}

	get sandbox(): Sandbox {
		const sandbox = this.query.data;
		if (!sandbox) {
			throw new Error('The sandbox detail was read before the sandbox loaded');
		}
		return sandbox;
	}

	get pending(): boolean {
		return this.#runningActions.current > 0;
	}

	refresh = async (): Promise<void> => {
		await Promise.all(
			sandboxChangeQueryKeys(this.#sandboxId()).map((queryKey) =>
				this.#queryClient.invalidateQueries({ queryKey })
			)
		);
	};
}

export const [getSandboxDetail, setSandboxDetail] =
	createContext<SandboxDetail>();
