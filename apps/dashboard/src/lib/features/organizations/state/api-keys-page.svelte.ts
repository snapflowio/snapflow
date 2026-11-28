/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import Ban from '@lucide/svelte/icons/ban';
import Copy from '@lucide/svelte/icons/copy';
import Gauge from '@lucide/svelte/icons/gauge';
import History from '@lucide/svelte/icons/history';
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
import type { HeaderAction } from '#lib/components/page/header-actions.ts';
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';
import { copyWithToast } from '#lib/components/ui/clipboard/copy-with-toast.ts';
import { auditActorHref } from '#lib/features/audit/lib/audit-list.ts';
import { getAuth } from '#lib/features/auth/state/auth.svelte.ts';
import { apiKeyStatus } from '#lib/features/organizations/lib/api-key-display.ts';
import { API_KEY_SCOPE_OPTIONS } from '#lib/features/organizations/lib/api-key-permissions.ts';
import {
	apiKeysSearchSchema,
	matchesApiKey,
} from '#lib/features/organizations/lib/api-keys-page.ts';
import { getOrganizationPermission } from '#lib/features/organizations/state/organization-permission.svelte.ts';
import { SearchParams } from '#lib/routing/search-params.svelte.ts';
import { goto } from '$app/navigation';

const NO_CREATE_PERMISSION_REASON = "Your role can't create API keys";
const NO_SCOPES_REASON = 'Your role has no permissions a key could use';

export class ApiKeysPage {
	readonly #auth = getAuth();
	readonly #permission = getOrganizationPermission();
	readonly #organizationId = $derived(this.#auth.activeOrganizationId ?? '');
	readonly #createKeyMutation = createMutation(() =>
		createApiKeyMutationOptions(this.#organizationId)
	);

	readonly #params = new SearchParams(apiKeysSearchSchema);
	readonly search = this.#params.text('search');
	readonly apiKeysQuery = createQuery(() =>
		apiKeysQueryOptions(this.#organizationId)
	);
	readonly updateMutation = createMutation(() =>
		updateApiKeyMutationOptions(this.#organizationId)
	);
	readonly removeMutation = createMutation(() =>
		deleteApiKeyMutationOptions(this.#organizationId)
	);

	renaming = $state.raw<ApiKeyListItem | null>(null);
	deleting = $state.raw<ApiKeyListItem | null>(null);
	budgeting = $state.raw<ApiKeyListItem | null>(null);

	readonly #canCreate = $derived(this.#permission.can({ apiKey: ['create'] }));
	readonly #canUpdate = $derived(this.#permission.can({ apiKey: ['update'] }));
	readonly canEditBudget = $derived(this.#canUpdate);
	readonly #canDelete = $derived(this.#permission.can({ apiKey: ['delete'] }));
	readonly #canViewAudit = $derived(
		this.#permission.can({ audit_logs: ['read'] })
	);
	readonly scopeOptions = $derived(
		API_KEY_SCOPE_OPTIONS.filter((option) =>
			this.#permission.can(option.permission)
		)
	);
	readonly createDisabledReason = $derived.by(() => {
		if (!this.#canCreate) return NO_CREATE_PERMISSION_REASON;
		if (this.scopeOptions.length === 0) return NO_SCOPES_REASON;
		return undefined;
	});
	createOpen = $derived(
		Boolean(this.#params.current.create) &&
			this.createDisabledReason === undefined
	);
	readonly query = $derived(this.search.value.trim());
	readonly allKeys = $derived(this.apiKeysQuery.data ?? []);
	readonly apiKeys = $derived(
		this.allKeys.filter((apiKey) =>
			matchesApiKey(apiKey, this.query.toLowerCase())
		)
	);
	readonly activeKeys = $derived(
		this.apiKeys.filter((apiKey) => apiKeyStatus(apiKey) !== 'expired')
	);
	readonly expiredKeys = $derived(
		this.apiKeys.filter((apiKey) => apiKeyStatus(apiKey) === 'expired')
	);
	readonly headerActions = $derived.by((): HeaderAction[] => [
		{
			id: 'create',
			kind: 'primary',
			label: 'Create API key',
			icon: Plus,
			disabled: this.createDisabledReason !== undefined,
			disabledReason: this.createDisabledReason,
			onSelect: () => this.changeCreateOpen(true),
		},
	]);

	changeCreateOpen = (open: boolean): void => {
		this.createOpen = open;
		if (!open && this.#params.current.create)
			void this.#params.update({ create: undefined });
	};

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

	createKey = async (body: CreateApiKeyDto): Promise<string | null> => {
		let secret: string | null = null;
		await submitMutation(async () => {
			const created = await this.#createKeyMutation.mutateAsync(body);
			secret = created.key;
		});
		return secret;
	};

	deleteKey = (apiKey: ApiKeyListItem): void => {
		this.removeMutation.mutate(apiKey, {
			onSuccess: () => {
				this.deleting = null;
			},
		});
	};

	rowActions = (apiKey: ApiKeyListItem): ResourceRowAction[] => [
		{
			icon: Copy,
			label: 'Copy prefix',
			visible: Boolean(apiKey.start),
			onSelect: () => void copyWithToast(apiKey.start ?? '', 'key prefix'),
		},
		{
			icon: Pencil,
			label: 'Rename',
			onSelect: () => (this.renaming = apiKey),
			visible: this.#canUpdate,
		},
		{
			icon: Gauge,
			label: 'Budget',
			onSelect: () => (this.budgeting = apiKey),
		},
		{
			icon: History,
			label: 'View activity',
			visible: this.#canViewAudit,
			onSelect: () => void goto(auditActorHref(apiKey.id)),
		},
		{
			icon: apiKey.enabled ? Pause : Play,
			label: apiKey.enabled ? 'Disable' : 'Enable',
			onSelect: () => this.saveChange({ apiKey, enabled: !apiKey.enabled }),
			visible: this.#canUpdate,
		},
		{
			icon: Ban,
			label: 'Revoke',
			destructive: true,
			visible: this.#canDelete,
			onSelect: () => (this.deleting = apiKey),
		},
	];
}
