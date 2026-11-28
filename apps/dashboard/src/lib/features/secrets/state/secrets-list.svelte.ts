/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import Copy from '@lucide/svelte/icons/copy';
import Pencil from '@lucide/svelte/icons/pencil';
import Plus from '@lucide/svelte/icons/plus';
import RotateCw from '@lucide/svelte/icons/rotate-cw';
import type { SecretDto } from '@snapflow/api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import {
	allSecretsQueryOptions,
	deleteSecretMutationOptions,
} from '#lib/api/secrets.ts';
import Trash from '#lib/components/icons/trash.svelte';
import { ClientPagination } from '#lib/components/resource/resource-client-pagination.svelte.ts';
import {
	activeSort,
	resourceListSortConfig,
	sortRows,
} from '#lib/components/resource/resource-list.ts';
import type { ResourceSortConfig } from '#lib/components/resource/resource-options.ts';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import { copyWithToast } from '#lib/components/ui/clipboard/copy-with-toast.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import {
	matchesSecret,
	SECRET_PANEL_PARAM,
	SECRET_SORT_ACCESSORS,
	SECRET_SORT_OPTIONS,
	secretsSearchSchema,
} from '#lib/features/secrets/lib/secrets-list.ts';
import { OpenRowParam } from '#lib/routing/open-row-param.svelte.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';

export class SecretsList {
	readonly #permission = getOrganizationPermission();
	readonly #params = new SearchParams(secretsSearchSchema);
	#lastOpened: SecretDto | null = null;

	readonly search = this.#params.text('search');
	readonly secretsQuery = createQuery(() => allSecretsQueryOptions());
	readonly deleteMutation = createMutation(() => {
		const options = deleteSecretMutationOptions();
		return { ...options, meta: { ...options.meta, failure: undefined } };
	});

	createOpen = $state(false);
	editing = $state.raw<SecretDto | null>(null);
	rotating = $state.raw<SecretDto | null>(null);
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
	readonly pagination = new ClientPagination(
		() => this.secrets,
		() => [this.search.value, this.#sort]
	);
	readonly panel = new OpenRowParam(
		() => this.secrets,
		(secret) => secret.id,
		{ param: SECRET_PANEL_PARAM, pushOnSwitch: true }
	);
	readonly panelSecret: SecretDto | null = $derived.by(() => {
		if (this.panel.row) this.#lastOpened = this.panel.row;
		return this.panel.row ?? this.#lastOpened;
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

	clearSearch = (): void => {
		this.search.value = '';
		void this.#params.update({ search: '' });
	};

	cancelDelete = (): void => {
		this.deleting = null;
		this.deleteMutation.reset();
	};

	remove = (secret: SecretDto): void => {
		this.deleteMutation.mutate(secret, {
			onSuccess: () => {
				this.deleting = null;
				if (this.panel.openId === secret.id) this.panel.close();
			},
		});
	};

	rowActions = (secret: SecretDto): ResourceRowAction[] => [
		{
			icon: Pencil,
			label: 'Edit',
			onSelect: () => {
				this.editing = secret;
			},
			visible: this.canWrite,
		},
		{
			icon: RotateCw,
			label: 'Rotate value',
			onSelect: () => {
				this.rotating = secret;
			},
			visible: this.canWrite,
		},
		{
			icon: Copy,
			label: 'Copy ID',
			onSelect: () => void copyWithToast(secret.id, 'secret ID'),
		},
		{
			icon: Trash,
			label: 'Delete',
			destructive: true,
			onSelect: () => {
				this.deleting = secret;
			},
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
