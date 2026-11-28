<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import KeyRound from '@lucide/svelte/icons/key-round';
import Plus from '@lucide/svelte/icons/plus';
import Search from '@lucide/svelte/icons/search';
import type { ApiKeyListItem } from '#lib/api/organizations/api-keys.ts';
import EmptyState from '#lib/components/empty-state.svelte';
import FeedbackState from '#lib/components/feedback-state.svelte';
import SettingsPage from '#lib/components/settings/settings-page.svelte';
import SettingsResourceRow from '#lib/components/settings/settings-resource-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import Skeleton, {
	SKELETON_SECTION_ROWS,
} from '#lib/components/ui/skeleton/skeleton.svelte';
import ApiKeysPageDialogs from '#lib/features/organizations/components/api-keys/api-keys-page-dialogs.svelte';
import {
	API_KEY_STATUS_DISPLAY,
	apiKeyInactive,
	apiKeyMeta,
	apiKeyPrefix,
	apiKeyStatus,
} from '#lib/features/organizations/lib/api-key-display.ts';
import { ApiKeysPage } from '#lib/features/organizations/state/api-keys-page.svelte.ts';

const page = new ApiKeysPage();
</script>

{#snippet keyRows(keys: readonly ApiKeyListItem[])}
	{#each keys as apiKey (apiKey.id)}
		{const status = $derived(apiKeyStatus(apiKey))}
		{const display = $derived(API_KEY_STATUS_DISPLAY[status])}
		{#snippet badge()}
			<Badge size="sm" variant={display.badge}>{display.label}</Badge>
		{/snippet}
		{#snippet meta()}
			<span class="font-mono text-xs">{apiKeyPrefix(apiKey)}</span>
			<span>· {apiKeyMeta(apiKey)}</span>
		{/snippet}
		<SettingsResourceRow
			title={apiKey.name ?? apiKey.id}
			{meta}
			icon={KeyRound}
			dimmed={apiKeyInactive(status)}
			{badge}
			actions={page.rowActions(apiKey)}
			actionsLabel={`${apiKey.name ?? 'API key'} actions`}
		/>
	{/each}
{/snippet}

<SettingsPage
	title="API keys"
	search={page.allKeys.length > 0
		? {
				value: page.search.value,
				onChange: (value) => (page.search.value = value),
				placeholder: 'Search API keys',
			}
		: undefined}
	actions={page.headerActions}
>
	{#if page.apiKeysQuery.isError && page.apiKeysQuery.data === undefined}
		<FeedbackState
			class="flex-1"
			tone="error"
			resource="API keys"
			error={page.apiKeysQuery.error}
			retrying={page.apiKeysQuery.isFetching}
			onRetry={() => void page.apiKeysQuery.refetch()}
		/>
	{:else if page.apiKeysQuery.isPending}
		<Skeleton class="h-14" repeat={SKELETON_SECTION_ROWS} fade />
	{:else if page.allKeys.length === 0}
		<EmptyState
			icon={KeyRound}
			title="No API keys yet"
			description="Create a key to call the Snapflow API, SDK or CLI."
		>
			{#snippet actions()}
				<Chip
					variant="secondary"
					leftIcon={Plus}
					disabledReason={page.createDisabledReason}
					onclick={() => page.changeCreateOpen(true)}
				>
					Create API key
				</Chip>
			{/snippet}
		</EmptyState>
	{:else if page.apiKeys.length === 0}
		<EmptyState icon={Search} title={`No results for “${page.query}”`}>
			{#snippet actions()}
				<Chip variant="secondary" onclick={() => (page.search.value = '')}>
					Clear search
				</Chip>
			{/snippet}
		</EmptyState>
	{:else}
		{#if page.activeKeys.length > 0}
			<SettingsSection title={`Active (${page.activeKeys.length})`}>
				{@render keyRows(page.activeKeys)}
			</SettingsSection>
		{/if}
		{#if page.expiredKeys.length > 0}
			<SettingsSection title={`Expired (${page.expiredKeys.length})`}>
				{@render keyRows(page.expiredKeys)}
			</SettingsSection>
		{/if}
	{/if}
</SettingsPage>

<ApiKeysPageDialogs {page} />
