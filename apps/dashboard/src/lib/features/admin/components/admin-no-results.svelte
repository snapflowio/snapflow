<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import EmptyState from '#lib/components/empty-state.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';

interface AdminNoResultsProps {
	search?: string;
	filterCount?: number;
	onClear: () => void;
}

let { search = '', filterCount = 0, onClear }: AdminNoResultsProps = $props();

const query = $derived(search.trim());
const clearLabel = $derived.by(() => {
	if (query && filterCount > 0) return 'Clear search and filters';
	return query ? 'Clear search' : 'Clear filters';
});
</script>

<EmptyState
	illustration={false}
	title={query ? `No results for “${query}”` : 'No results'}
>
	{#snippet actions()}
		<Chip variant="border" onclick={onClear}>{clearLabel}</Chip>
	{/snippet}
</EmptyState>
