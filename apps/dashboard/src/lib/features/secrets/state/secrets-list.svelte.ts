/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
import Copy from '@lucide/svelte/icons/copy';
import Plus from '@lucide/svelte/icons/plus';
import type { SecretDto } from '@snapflow/api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import {
	allSecretsQueryOptions,
	deleteSecretMutationOptions,
} from '#lib/api/secrets.ts';
import Trash from '#lib/components/icons/trash.svelte';
import {
	activeSort,
	resourceListSortConfig,
	sortRows,
} from '#lib/components/resource/resource-list.ts';
import type { ResourceSortConfig } from '#lib/components/resource/resource-options.ts';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import { CopyToClipboard } from '#lib/components/ui/clipboard/copy-to-clipboard.svelte.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import {
	matchesSecret,
	SECRET_SORT_ACCESSORS,
	SECRET_SORT_OPTIONS,
	secretsSearchSchema,
} from '#lib/features/secrets/lib/secrets-list.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';

export class SecretsList {
	readonly #permission = getOrganizationPermission();
	readonly #params = new SearchParams(secretsSearchSchema);
	readonly #clipboard = new CopyToClipboard();

	readonly search = this.#params.text('search');
	readonly secretsQuery = createQuery(() => allSecretsQueryOptions());
	readonly deleteMutation = createMutation(() => deleteSecretMutationOptions());

	createOpen = $state(false);
	deleting = $state.raw<SecretDto | null>(null);

	readonly canWrite = $derived(this.#permission.can({ secrets: ['write'] }));
	readonly canDelete = $derived(this.#permission.can({ secrets: ['delete'] }));
	readonly #sort = $derived(
		activeSort(this.#params.current.sort, this.#params.current.dir)
	);
	readonly secrets: readonly SecretDto[] = $derived.by(() => {
		const query = this.search.value.trim().toLowerCase();
		const filtered = (this.secretsQuery.data ?? []).filter((secret) =>
			matchesSecret(secret, query)
		);
		return sortRows(filtered, this.#sort, SECRET_SORT_ACCESSORS);
	});
	readonly sortConfig: ResourceSortConfig = $derived(
		resourceListSortConfig(
			SECRET_SORT_OPTIONS,
			this.#sort,
			(column, direction) => {
				void this.#params.update({ sort: column, dir: direction });
			}
		)
	);

	openCreate = (): void => {
		this.createOpen = true;
	};

	openSecret = (secretId: string): void => {
		void goto(resolve('/(app)/(dashboard)/secrets/[secretId]', { secretId }));
	};

	clearSearch = (): void => {
		this.search.value = '';
		void this.#params.update({ search: '' });
	};

	remove = (secret: SecretDto): void => {
		this.deleteMutation.mutate(secret, {
			onSuccess: () => {
				this.deleting = null;
			},
		});
	};

	rowActions = (secret: SecretDto): ResourceRowAction[] => [
		{
			icon: ArrowUpRight,
			label: 'Open',
			onSelect: () => this.openSecret(secret.id),
		},
		{
			icon: Copy,
			label: 'Copy ID',
			onSelect: () => void this.#clipboard.copy(secret.id),
		},
		{
			icon: Trash,
			label: 'Delete',
			onSelect: () => {
				this.deleting = secret;
			},
			separated: true,
			visible: this.canDelete,
		},
	];

	contextActions = (rowId: string | null): ResourceRowAction[] => {
		if (rowId === null) {
			return [
				{
					icon: Plus,
					label: 'New secret',
					onSelect: this.openCreate,
					visible: this.canWrite,
				},
			];
		}
		const secret = this.secrets.find((candidate) => candidate.id === rowId);
		return secret ? this.rowActions(secret) : [];
	};
}
