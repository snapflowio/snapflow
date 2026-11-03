<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import BookOpen from '@lucide/svelte/icons/book-open';
import Plus from '@lucide/svelte/icons/plus';
import { getWebsiteLinks } from '#lib/api/public-config.ts';
import EmptyState from '#lib/components/empty-state.svelte';
import TerminalWindow from '#lib/components/icons/terminal-window.svelte';
import Resource from '#lib/components/resource/resource.svelte';
import ResourceChromeFallback from '#lib/components/resource/resource-chrome-fallback.svelte';
import ResourceHeader from '#lib/components/resource/resource-header.svelte';
import ResourceOptionsBar from '#lib/components/resource/resource-options-bar.svelte';
import ResourcePagination from '#lib/components/resource/resource-pagination.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import SandboxListFilters from '#lib/features/sandboxes/components/sandbox-list-filters.svelte';
import SandboxesListDialogs from '#lib/features/sandboxes/components/sandboxes-list-dialogs.svelte';
import SandboxesTable from '#lib/features/sandboxes/components/sandboxes-table.svelte';
import {
	SANDBOX_COLUMN_LABELS,
	SANDBOX_SEARCH_PLACEHOLDER,
} from '#lib/features/sandboxes/lib/sandboxes-list.ts';
import { SandboxesList } from '#lib/features/sandboxes/state/sandboxes-list.svelte.ts';

const { docsHref } = getWebsiteLinks();
const list = new SandboxesList();
</script>

{#snippet filters()}
	<SandboxListFilters />
{/snippet}

{#snippet emptyState()}
	{#if list.narrowed}
		<EmptyState
			illustration={false}
			title={list.appliedSearch
				? `No results for “${list.appliedSearch}”`
				: 'No results'}
		>
			{#snippet actions()}
				<Chip variant="border" onclick={list.clearSearchAndFilters}>
					{list.clearLabel}
				</Chip>
			{/snippet}
		</EmptyState>
	{:else}
		<EmptyState
			title="Sandboxes"
			description="Create a sandbox to run code on an isolated machine."
		>
			{#snippet actions()}
				<Chip
					variant="primary"
					leftIcon={Plus}
					disabled={!list.canWrite}
					onclick={list.openCreate}
				>
					New sandbox
				</Chip>
				<Chip
					variant="border"
					leftIcon={BookOpen}
					href={docsHref}
					target="_blank"
					rel="noopener noreferrer"
				>
					Docs
				</Chip>
			{/snippet}
		</EmptyState>
	{/if}
{/snippet}

{#if list.sandboxesQuery.isPending}
	<ResourceChromeFallback
		icon={TerminalWindow}
		title="Sandboxes"
		createLabel="New sandbox"
		searchPlaceholder={SANDBOX_SEARCH_PLACEHOLDER}
		columns={SANDBOX_COLUMN_LABELS}
	/>
{:else}
	<Resource>
		<ResourceHeader
			icon={TerminalWindow}
			title="Sandboxes"
			create={{
				label: 'New sandbox',
				onSelect: list.openCreate,
				disabled: !list.canWrite,
			}}
		/>
		<ResourceOptionsBar
			search={{
				value: list.search.value,
				onChange: (value) => (list.search.value = value),
				placeholder: SANDBOX_SEARCH_PLACEHOLDER,
				ariaLabel: 'Search sandboxes',
			}}
			filterTags={list.filterTags}
			filter={{ active: list.filterTags.length > 0, content: filters }}
			sort={list.sortConfig}
		/>
		<SandboxesTable
			sandboxes={list.sandboxes}
			bind:selectedRowIds={list.selectedRowIds}
			isLoading={list.sandboxesQuery.isLoading}
			isError={list.sandboxesQuery.isError}
			onRetry={() => void list.sandboxesQuery.refetch()}
			permissions={{ canWrite: list.canWrite, canDelete: list.canDelete }}
			empty={emptyState}
			onCreate={list.openCreate}
			onAction={list.runAction}
			onDelete={list.requestDelete}
		/>
		<ResourcePagination pagination={list.pagination} />
	</Resource>
{/if}

<SandboxesListDialogs {list} />
