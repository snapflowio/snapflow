<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const PERCENT_SCALE = 100;

interface MeterProps {
	label: string;
	marker?: number;
	maximum: number;
	tone?: 'default' | 'error';
	value: number;
	valueText: string;
}

function percentOf(value: number, maximum: number): number {
	if (maximum <= 0) return 0;
	return Math.min(
		PERCENT_SCALE,
		Math.max(0, (value / maximum) * PERCENT_SCALE)
	);
}
</script>

<script lang="ts">
import { Meter } from 'bits-ui';
import { cn } from '#lib/utils/utils.ts';

let {
	label,
	marker,
	maximum,
	tone = 'default',
	value,
	valueText,
}: MeterProps = $props();
</script>

<Meter.Root
	value={Math.min(value, maximum)}
	max={maximum}
	aria-label={label}
	aria-valuetext={valueText}
	class="relative h-1 w-full rounded-full bg-surface-6"
>
	<span
		class={cn(
			'block h-1 rounded-full transition-[width]',
			tone === 'error' ? 'bg-(--destructive)' : 'bg-(--text-primary)'
		)}
		style:width={`${percentOf(value, maximum)}%`}
	></span>
	{#if marker !== undefined}
		<span
			aria-hidden="true"
			class="absolute -top-1 h-3 w-px bg-(--text-muted)"
			style:left={`${percentOf(marker, maximum)}%`}
		></span>
	{/if}
</Meter.Root>
