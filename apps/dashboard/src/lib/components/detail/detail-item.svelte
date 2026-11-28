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
import InfoTooltip from '#lib/components/page/info-tooltip.svelte';
import { EMPTY_CELL_PLACEHOLDER } from '#lib/components/resource/table/resource-table.ts';
import { cn } from '#lib/utils/utils.ts';

interface DetailItemProps {
	label: string;
	info?: string;
	value?: string | null;
	mono?: boolean;
	children?: Snippet;
}

let { label, info, value, mono = false, children }: DetailItemProps = $props();
</script>

<div
	class="flex min-w-0 items-center justify-between gap-4 border-border border-t py-2 text-sm"
>
	<dt class="flex shrink-0 items-center gap-x-1.5 text-(--text-muted)">
		<span class="whitespace-nowrap">{label}</span>
		{#if info}
			<InfoTooltip content={info} />
		{/if}
	</dt>
	<dd
		class={cn(
			'flex min-w-0 items-center justify-end gap-x-2 text-right text-(--text-primary) tabular-nums',
			mono && 'font-mono text-xs'
		)}
	>
		{#if children}
			{@render children()}
		{:else if value}
			<span class="wrap-break-word min-w-0 text-pretty">{value}</span>
		{:else}
			<span class="text-(--text-subtle)">{EMPTY_CELL_PLACEHOLDER}</span>
		{/if}
	</dd>
</div>
