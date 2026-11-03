<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
interface ResourceListEmptyCreate {
	label: string;
	onSelect: () => void;
	disabled?: boolean;
}

interface ResourceListEmptyProps {
	title: string;
	description: string;
	create?: ResourceListEmptyCreate;
	search: string;
	filterCount?: number;
	onClear: () => void;
}

function clearLabel(search: string, filterCount: number): string {
	if (search && filterCount > 0) return 'Clear search and filters';
	return search ? 'Clear search' : 'Clear filters';
}
</script>

<script lang="ts">
import BookOpen from '@lucide/svelte/icons/book-open';
import Plus from '@lucide/svelte/icons/plus';
import { getWebsiteLinks } from '#lib/api/public-config.ts';
import EmptyState from '#lib/components/empty-state.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';

let {
	title,
	description,
	create,
	search,
	filterCount = 0,
	onClear,
}: ResourceListEmptyProps = $props();

const { docsHref } = getWebsiteLinks();
const trimmedSearch = $derived(search.trim());
const narrowed = $derived(trimmedSearch.length > 0 || filterCount > 0);
</script>

{#if narrowed}
	<EmptyState
		illustration={false}
		title={trimmedSearch ? `No results for “${trimmedSearch}”` : 'No results'}
	>
		{#snippet actions()}
			<Chip variant="border" onclick={onClear}>
				{clearLabel(trimmedSearch, filterCount)}
			</Chip>
		{/snippet}
	</EmptyState>
{:else}
	<EmptyState {title} {description}>
		{#snippet actions()}
			{#if create}
				<Chip
					variant="primary"
					leftIcon={Plus}
					disabled={create.disabled}
					onclick={create.onSelect}
				>
					{create.label}
				</Chip>
			{/if}
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
