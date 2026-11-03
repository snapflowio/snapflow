<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import FeedbackState from '#lib/components/feedback-state.svelte';
import SettingsPage from '#lib/components/settings/settings-page.svelte';
import SettingsResourceRow from '#lib/components/settings/settings-resource-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import ApiKeysPageDialogs from '#lib/features/organizations/components/api-keys/api-keys-page-dialogs.svelte';
import RowActionsMenu from '#lib/features/organizations/components/settings/row-actions-menu.svelte';
import {
	apiKeyDescription,
	apiKeyLastUsed,
} from '#lib/features/organizations/lib/api-key-display.ts';
import { ApiKeysPage } from '#lib/features/organizations/state/api-keys-page.svelte.ts';

const page = new ApiKeysPage();
</script>

<SettingsPage
	title="API keys"
	description="Keys that authenticate the Snapflow API and CLI."
	search={{
		value: page.search.value,
		onChange: (value) => (page.search.value = value),
		placeholder: 'Search API keys...',
	}}
	actions={page.headerActions}
>
	{#if page.apiKeysQuery.isError && page.apiKeysQuery.data === undefined}
		<FeedbackState
			class="flex-1"
			tone="error"
			retrying={page.apiKeysQuery.isFetching}
			onRetry={() => void page.apiKeysQuery.refetch()}
		>
			Failed to load API keys
		</FeedbackState>
	{:else if page.apiKeysQuery.isPending}
		<FeedbackState variant="inline">Loading API keys...</FeedbackState>
	{:else if page.allKeys.length === 0}
		<FeedbackState class="flex-1">
			Click “Create API key” above to get started
		</FeedbackState>
	{:else if page.apiKeys.length === 0}
		<FeedbackState variant="inline">
			No API keys found matching “{page.query}”
		</FeedbackState>
	{:else}
		<SettingsSection title="Organization">
			<div class="flex flex-col gap-y-0.5">
				{#each page.apiKeys as apiKey (apiKey.id)}
					{#snippet badge()}
						<span class="whitespace-nowrap text-(--text-muted) text-caption">
							{apiKeyLastUsed(apiKey)}
						</span>
					{/snippet}
					{#snippet trailing()}
						<div class="shrink-0">
							<RowActionsMenu
								label="API key actions"
								actions={page.rowActions(apiKey)}
							/>
						</div>
					{/snippet}
					<SettingsResourceRow
						title={apiKey.name ?? apiKey.id}
						description={apiKeyDescription(apiKey)}
						{badge}
						{trailing}
					/>
				{/each}
			</div>
		</SettingsSection>
	{/if}
</SettingsPage>

<ApiKeysPageDialogs {page} />
