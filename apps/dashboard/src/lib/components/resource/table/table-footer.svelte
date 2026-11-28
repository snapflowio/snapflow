<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { Snippet } from 'svelte';
import type { ResourcePaginationConfig } from '#lib/components/resource/resource-pagination.ts';
import ResourcePaginationCompact from '#lib/components/resource/resource-pagination-compact.svelte';

interface TableFooterProps {
	label?: string;
	pagination?: ResourcePaginationConfig;
	children?: Snippet;
}

let { label, pagination, children }: TableFooterProps = $props();
</script>

<div
	class="flex h-11 shrink-0 items-center justify-between gap-4 border-border border-t px-4 text-(--text-muted) text-sm tabular-nums"
>
	<div class="flex min-w-0 items-center gap-x-2">
		{#if children}
			{@render children()}
		{:else}
			<span class="truncate">{label}</span>
		{/if}
	</div>
	{#if pagination}
		<ResourcePaginationCompact {pagination} />
	{/if}
</div>
