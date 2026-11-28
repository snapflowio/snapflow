<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
export type StatisticCardSize = 'sm' | 'lg';

const SIZE_CLASS: Record<StatisticCardSize, { root: string; value: string }> = {
	sm: { root: 'gap-1', value: 'heading-xxs' },
	lg: { root: 'gap-2', value: 'heading-s' },
};
</script>

<script lang="ts">
import type { Snippet } from 'svelte';
import InfoTooltip from '#lib/components/page/info-tooltip.svelte';
import { cn } from '#lib/utils/utils.ts';

interface StatisticCardProps {
	label: string;
	info?: string;
	value?: string;
	size?: StatisticCardSize;
	children?: Snippet;
}

let {
	label,
	info,
	value,
	size = 'sm',
	children,
}: StatisticCardProps = $props();
</script>

<div class="flex min-w-0 flex-1">
	<div
		class={cn(
			'flex min-w-0 flex-1 flex-col border-border-strong border-t pt-3',
			SIZE_CLASS[size].root
		)}
	>
		<div class="flex min-w-0 items-center gap-x-1.5">
			<span class="truncate text-(--text-muted) text-sm">{label}</span>
			{#if info}
				<InfoTooltip content={info} />
			{/if}
		</div>
		<div
			class={cn(
				'wrap-break-word min-w-0 text-pretty tabular-nums',
				SIZE_CLASS[size].value
			)}
		>
			{#if children}
				{@render children()}
			{:else}
				{value}
			{/if}
		</div>
	</div>
</div>
