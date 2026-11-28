<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { ClassValue } from 'svelte/elements';

export type MeterVariant = 'default' | 'compact' | 'gauge';
export type MeterTone = 'auto' | 'default' | 'warning' | 'error';
export type MeterMarkerTone = 'default' | 'warning' | 'error';

export interface MeterMarker {
	value: number;
	label: string;
	tone?: MeterMarkerTone;
}

export interface MeterProps {
	label: string;
	value: number;
	maximum: number;
	valueText: string;
	variant?: MeterVariant;
	tone?: MeterTone;
	forecast?: number;
	marker?: number;
	markers?: readonly MeterMarker[];
	class?: ClassValue;
}

const PERCENT_SCALE = 100;
export const QUOTA_WARNING_RATIO = 0.8;
const MARKER_LABEL_FLIP_PERCENT = 70;

const TRACK_CLASS: Record<MeterVariant, string> = {
	default: 'h-1 rounded-full bg-surface-7',
	compact: 'h-0.5 rounded-full bg-surface-7',
	gauge: 'h-1.5 rounded-full bg-surface-7',
};

const FILL_TONE_CLASS: Record<Exclude<MeterTone, 'auto'>, string> = {
	default: 'bg-(--accent)',
	warning: 'bg-(--warning)',
	error: 'bg-(--destructive)',
};

const MARKER_TONE_CLASS: Record<MeterMarkerTone, string> = {
	default: 'border-(--text-subtle) text-(--text-subtle)',
	warning: 'border-(--warning) text-(--warning)',
	error: 'border-(--destructive) text-(--destructive)',
};

const FORECAST_HATCH =
	'repeating-linear-gradient(-45deg, var(--text-tertiary) 0 4px, transparent 4px 8px)';

function percentOf(value: number, maximum: number): number {
	if (maximum <= 0) return 0;
	return Math.min(
		PERCENT_SCALE,
		Math.max(0, (value / maximum) * PERCENT_SCALE)
	);
}

function autoTone(value: number, maximum: number): Exclude<MeterTone, 'auto'> {
	if (maximum <= 0) return 'default';
	const ratio = value / maximum;
	if (ratio > 1) return 'error';
	if (ratio >= QUOTA_WARNING_RATIO) return 'warning';
	return 'default';
}
</script>

<script lang="ts">
import { Meter } from 'bits-ui';
import { prefersReducedMotion } from 'svelte/motion';
import { cn } from '#lib/utils/utils.ts';

let {
	label,
	value,
	maximum,
	valueText,
	variant = 'default',
	tone = 'auto',
	forecast,
	marker,
	markers = [],
	class: className,
}: MeterProps = $props();

const resolvedTone = $derived(
	tone === 'auto' ? autoTone(value, maximum) : tone
);
const fillPercent = $derived(percentOf(value, maximum));
const forecastPercent = $derived(
	forecast === undefined ? null : percentOf(forecast, maximum)
);
const allMarkers = $derived<readonly MeterMarker[]>(
	marker === undefined ? markers : [...markers, { value: marker, label: '' }]
);
const hasLabels = $derived(allMarkers.some((item) => item.label.length > 0));
</script>

<div class={cn('relative w-full', hasLabels && 'pt-4', className)}>
	<Meter.Root
		value={Math.min(value, maximum)}
		max={maximum}
		aria-label={label}
		aria-valuetext={valueText}
		class={cn('relative w-full overflow-hidden', TRACK_CLASS[variant])}
	>
		{#if forecastPercent !== null && forecastPercent > fillPercent}
			<span
				aria-hidden="true"
				class="absolute inset-y-0 left-0 opacity-40"
				style:width={`${forecastPercent}%`}
				style:background-image={FORECAST_HATCH}
			></span>
		{/if}
		<span
			class={cn(
				'relative block h-full',
				'rounded-full',
				FILL_TONE_CLASS[resolvedTone],
				!prefersReducedMotion.current &&
					'transition-[width] duration-(--motion-emphasis) ease-(--ease-enter)'
			)}
			style:width={`${fillPercent}%`}
		></span>
	</Meter.Root>
	{#each allMarkers as item, index (`${index}-${item.value}`)}
		{const left = $derived(percentOf(item.value, maximum))}
		<span
			aria-hidden="true"
			class={cn(
				'absolute bottom-0 border-l border-dashed',
				hasLabels ? 'top-3' : '-top-1',
				MARKER_TONE_CLASS[item.tone ?? 'default']
			)}
			style:left={`${left}%`}
		>
			{#if item.label}
				<span
					class={cn(
						'absolute -top-4 whitespace-nowrap text-xs leading-none tabular-nums',
						left > MARKER_LABEL_FLIP_PERCENT ? 'right-1' : 'left-1'
					)}
				>
					{item.label}
				</span>
			{/if}
		</span>
	{/each}
</div>
