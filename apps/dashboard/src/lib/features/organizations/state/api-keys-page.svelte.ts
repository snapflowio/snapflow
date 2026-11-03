/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import Copy from '@lucide/svelte/icons/copy';
import Pause from '@lucide/svelte/icons/pause';
import Pencil from '@lucide/svelte/icons/pencil';
import Plus from '@lucide/svelte/icons/plus';
import type { CreateApiKeyDto } from '@snapflow/api-client';
import { createMutation, createQuery } from '@tanstack/svelte-query';
import {
	type ApiKeyChange,
	type ApiKeyListItem,
	apiKeysQueryOptions,
	createApiKeyMutationOptions,
	deleteApiKeyMutationOptions,
	updateApiKeyMutationOptions,
} from '#lib/api/organizations/api-keys.ts';
import { submitMutation } from '#lib/components/form/submit.ts';
import Play from '#lib/components/icons/play.svelte';
import Trash from '#lib/components/icons/trash.svelte';
import type { HeaderAction } from '#lib/components/page/header-actions.ts';
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';
import type { RowAction } from '#lib/features/organizations/components/settings/row-actions-menu.svelte';
import { API_KEY_SCOPE_OPTIONS } from '#lib/features/organizations/lib/api-key-permissions.ts';
import {
	apiKeysSearchSchema,
	matchesApiKey,
} from '#lib/features/organizations/lib/api-keys-page.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';

export class ApiKeysPage {
	readonly #auth = getAuth();
	readonly #permission = getOrganizationPermission();
	readonly #organizationId = $derived(this.#auth.activeOrganizationId ?? '');
	readonly #createKeyMutation = createMutation(() =>
		createApiKeyMutationOptions(this.#organizationId)
	);

	readonly search = new SearchParams(apiKeysSearchSchema).text('search');
	readonly apiKeysQuery = createQuery(() =>
		apiKeysQueryOptions(this.#organizationId)
	);
	readonly updateMutation = createMutation(() =>
		updateApiKeyMutationOptions(this.#organizationId)
	);
	readonly removeMutation = createMutation(() =>
		deleteApiKeyMutationOptions(this.#organizationId)
	);

	createOpen = $state(false);
	createdSecret = $state<string | null>(null);
	renaming = $state.raw<ApiKeyListItem | null>(null);
	deleting = $state.raw<ApiKeyListItem | null>(null);

	readonly #canCreate = $derived(this.#permission.can({ apiKey: ['create'] }));
	readonly #canUpdate = $derived(this.#permission.can({ apiKey: ['update'] }));
	readonly #canDelete = $derived(this.#permission.can({ apiKey: ['delete'] }));
	readonly scopeOptions = $derived(
		API_KEY_SCOPE_OPTIONS.filter((option) =>
			this.#permission.can(option.permission)
		)
	);
	readonly query = $derived(this.search.value.trim());
	readonly allKeys = $derived(this.apiKeysQuery.data ?? []);
	readonly apiKeys = $derived(
		this.allKeys.filter((apiKey) =>
			matchesApiKey(apiKey, this.query.toLowerCase())
		)
	);
	readonly headerActions = $derived.by((): HeaderAction[] => [
		{
			id: 'create',
			kind: 'primary',
			label: 'Create API key',
			icon: Plus,
			disabled: !this.#canCreate || this.scopeOptions.length === 0,
			onSelect: () => (this.createOpen = true),
		},
	]);

	closeRename = (open: boolean): void => {
		if (!open) this.renaming = null;
	};

	saveChange = (change: ApiKeyChange): void => {
		this.updateMutation.mutate(change, {
			onSuccess: () => {
				this.renaming = null;
			},
		});
	};

	createKey = (body: CreateApiKeyDto): Promise<boolean> =>
		submitMutation(async () => {
			const created = await this.#createKeyMutation.mutateAsync(body);
			this.createOpen = false;
			this.createdSecret = created.key;
		});

	deleteKey = (apiKey: ApiKeyListItem): void => {
		this.removeMutation.mutate(apiKey, {
			onSuccess: () => {
				this.deleting = null;
			},
		});
	};

	rowActions = (apiKey: ApiKeyListItem): RowAction[] => [
		{
			icon: Copy,
			label: 'Copy name',
			onSelect: () =>
				void navigator.clipboard.writeText(apiKey.name ?? apiKey.id),
		},
		{
			icon: Pencil,
			label: 'Rename',
			onSelect: () => (this.renaming = apiKey),
			visible: this.#canUpdate,
		},
		{
			icon: apiKey.enabled ? Pause : Play,
			label: apiKey.enabled ? 'Disable' : 'Enable',
			onSelect: () => this.saveChange({ apiKey, enabled: !apiKey.enabled }),
			visible: this.#canUpdate,
		},
		{
			icon: Trash,
			label: 'Delete',
			destructive: true,
			disabled: !this.#canDelete,
			onSelect: () => (this.deleting = apiKey),
		},
	];
}
