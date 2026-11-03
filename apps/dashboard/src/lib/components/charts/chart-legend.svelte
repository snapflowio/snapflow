<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const LEGEND_INSET_X = '16px';
const LEGEND_INSET_TOP = '12px';
</script>

<script lang="ts">
interface ChartLegendProps {
	items: readonly { key: string; label: string; color: string }[];
}

let { items }: ChartLegendProps = $props();
</script>

<div
	style:position="absolute"
	style:left={LEGEND_INSET_X}
	style:right={LEGEND_INSET_X}
	style:top={LEGEND_INSET_TOP}
	style:pointer-events="auto"
	class="flex items-center gap-4 select-none justify-end"
>
	{#each items as item (item.key)}
		<div class="flex items-center gap-1.5 transition-opacity">
			<div
				class="h-2 w-2 shrink-0 rounded-xs"
				style:background-color={item.color}
			></div>
			{item.label}
		</div>
	{/each}
</div>
