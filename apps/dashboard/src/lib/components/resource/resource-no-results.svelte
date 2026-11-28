<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Search from '@lucide/svelte/icons/search';
import EmptyState from '#lib/components/empty-state.svelte';
import { clearNarrowingLabel } from '#lib/components/resource/resource-list.ts';
import Chip from '#lib/components/ui/chip/chip.svelte';
import {
	filterTagSummary,
	type ResourceFilterTag,
} from './resource-options.ts';

interface ResourceNoResultsProps {
	search: string;
	filterCount?: number;
	filters?: readonly ResourceFilterTag[];
	resource?: string;
	onClear: () => void;
}

let {
	search,
	filterCount = 0,
	filters = [],
	resource,
	onClear,
}: ResourceNoResultsProps = $props();

const trimmedSearch = $derived(search.trim());
const title = $derived.by(() => {
	if (trimmedSearch) return `No results for “${trimmedSearch}”`;
	if (filters.length > 0) {
		return `No ${resource ?? 'results'} match ${filterTagSummary(filters)}`;
	}
	return 'No results';
});
</script>

<EmptyState icon={Search} bordered={false} {title}>
	{#snippet actions()}
		<Chip variant="secondary" onclick={onClear}>
			{clearNarrowingLabel(trimmedSearch, filterCount)}
		</Chip>
	{/snippet}
</EmptyState>
