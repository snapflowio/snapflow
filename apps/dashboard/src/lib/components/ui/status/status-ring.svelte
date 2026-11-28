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

export type StatusRingShape =
	| 'empty'
	| 'dashed'
	| 'half'
	| 'most'
	| 'check'
	| 'cross'
	| 'paused'
	| 'alert';

export type StatusRingTone = 'neutral' | 'success' | 'warning' | 'error';

export interface StatusRingProps {
	shape: StatusRingShape;
	tone?: StatusRingTone;
	live?: boolean;
	label?: string;
	class?: ClassValue;
}

const VIEWBOX = '0 0 14 14';
const CENTER = 7;
const RING_RADIUS = 5.75;
const RING_STROKE = 1.5;
const DISC_RADIUS = 6.5;
const PIE_RADIUS = 3.25;
const GLYPH_STROKE = 1.4;
const DASH_PATTERN = '2.2 1.6';

const TONE_CLASS: Record<StatusRingTone, string> = {
	neutral: 'text-(--text-subtle)',
	success: 'text-(--success)',
	warning: 'text-(--warning)',
	error: 'text-(--destructive)',
};

const HALF_PIE = `M ${CENTER} ${CENTER} L ${CENTER} ${CENTER - PIE_RADIUS} A ${PIE_RADIUS} ${PIE_RADIUS} 0 0 1 ${CENTER} ${CENTER + PIE_RADIUS} Z`;
const MOST_PIE = `M ${CENTER} ${CENTER} L ${CENTER} ${CENTER - PIE_RADIUS} A ${PIE_RADIUS} ${PIE_RADIUS} 0 1 1 ${CENTER - PIE_RADIUS} ${CENTER} Z`;

const GLYPHS: Partial<Record<StatusRingShape, string>> = {
	check: 'M4.4 7.2 6.2 9 9.6 5.2',
	cross: 'M5 5 9 9 M9 5 5 9',
	paused: 'M5.6 4.8 V9.2 M8.4 4.8 V9.2',
	alert: 'M7 4.2 V7.6 M7 9.6 V9.7',
};

const DISC_SHAPES: ReadonlySet<StatusRingShape> = new Set([
	'check',
	'cross',
	'paused',
	'alert',
]);
</script>

<script lang="ts">
import { cn } from '#lib/utils/utils.ts';

let {
	shape,
	tone = 'neutral',
	live = false,
	label,
	class: className,
}: StatusRingProps = $props();

const maskId = $props.id();
const isDisc = $derived(DISC_SHAPES.has(shape));
const glyph = $derived(GLYPHS[shape]);
</script>

<svg
	viewBox={VIEWBOX}
	fill="none"
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
	class={cn('size-3.5 shrink-0', TONE_CLASS[tone], className)}
>
	{#if isDisc && glyph}
		<mask id={maskId}>
			<rect width="14" height="14" fill="white" />
			<path
				d={glyph}
				stroke="black"
				stroke-width={GLYPH_STROKE}
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</mask>
		<circle
			cx={CENTER}
			cy={CENTER}
			r={DISC_RADIUS}
			fill="currentColor"
			mask={`url(#${maskId})`}
		/>
	{:else}
		<g
			class={cn(
				'origin-center',
				live && 'animate-[spin_2.4s_linear_infinite] motion-reduce:animate-none'
			)}
		>
			<circle
				cx={CENTER}
				cy={CENTER}
				r={RING_RADIUS}
				stroke="currentColor"
				stroke-width={RING_STROKE}
				stroke-dasharray={shape === 'dashed' ? DASH_PATTERN : undefined}
			/>
		</g>
		{#if shape === 'half'}
			<path d={HALF_PIE} fill="currentColor" />
		{:else if shape === 'most'}
			<path d={MOST_PIE} fill="currentColor" />
		{/if}
	{/if}
</svg>
