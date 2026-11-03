<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const ORIGIN_LEFT = '12px 12px';
const ORIGIN_RIGHT = 'calc(100% - 12px) 12px';
</script>

<script lang="ts">
import { Portal } from 'bits-ui';
import type { Snippet } from 'svelte';
import type { ClassValue } from 'svelte/elements';
import { TOOLTIP_SURFACE_CLASS } from '#lib/components/ui/chip/chip-chrome.ts';
import { cn } from '#lib/utils/utils.ts';
import { getTooltip } from './floating-tooltip.svelte.ts';
import { getTooltipTranslate, TOOLTIP_OFFSET } from './tooltip-geometry.ts';

interface TooltipContentProps {
	class?: ClassValue;
	children?: Snippet;
	offset?: number;
}

let {
	class: className,
	children,
	offset = TOOLTIP_OFFSET,
}: TooltipContentProps = $props();

const tooltip = getTooltip();
</script>

{#if tooltip.state.visible}
	<Portal>
		<div
			id={tooltip.contentId}
			role="tooltip"
			data-native-surface-overlay=""
			class={cn(
				TOOLTIP_SURFACE_CLASS,
				'pointer-events-none fixed top-0 left-0 z-(--z-tooltip) px-2 py-1.5 opacity-100 transition-[opacity,translate] duration-150 ease-out',
				'motion-reduce:transition-none',
				className
			)}
			style:translate={getTooltipTranslate(tooltip.state, offset)}
			style:scale={`${tooltip.state.scaleX} ${tooltip.state.scaleY}`}
			style:transform={`skew(${tooltip.state.skew}deg)`}
			style:transform-origin={tooltip.state.alignX === 'left'
				? ORIGIN_LEFT
				: ORIGIN_RIGHT}
		>
			{@render children?.()}
		</div>
	</Portal>
{/if}
