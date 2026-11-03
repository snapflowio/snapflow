<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const DEFAULT_KEYBOARD_STEP = 8;
const KEY_DIRECTION: Readonly<Record<string, number>> = {
	ArrowLeft: -1,
	ArrowRight: 1,
};

export type ResizeHandleEdge = 'left' | 'right';
</script>

<script lang="ts">
import { cn } from '#lib/utils/utils.ts';
import { pointerResize } from './pointer-resize.ts';

interface ResizeHandleProps {
	label: string;
	edge: ResizeHandleEdge;
	value: number;
	min: number;
	max: number;
	step?: number;
	widthAt: (clientX: number) => number;
	onResize: (width: number) => void;
	onCommit?: (width: number) => void;
	resizingClass?: string;
	class?: string;
}

let {
	label,
	edge,
	value,
	min,
	max,
	step = DEFAULT_KEYBOARD_STEP,
	widthAt,
	onResize,
	onCommit,
	resizingClass,
	class: className,
}: ResizeHandleProps = $props();

function resizeWithKeyboard(event: KeyboardEvent): void {
	const direction = KEY_DIRECTION[event.key];
	if (direction === undefined) return;
	event.preventDefault();
	const growth = edge === 'right' ? direction : -direction;
	(onCommit ?? onResize)(value + growth * step);
}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<!-- biome-ignore lint/a11y/useSemanticElements: a focusable window splitter (WAI-ARIA separator widget with aria-valuenow and keyboard resizing); <hr> is a static thematic break and cannot express that widget -->
<div
	{@attach pointerResize({
		widthAt,
		onResize,
		onEnd: (width) => {
			if (width !== null) onCommit?.(width);
		},
		resizingClass,
	})}
	class={cn(
		'absolute inset-y-0 w-2 cursor-ew-resize outline-none focus-visible:bg-brand-secondary/40',
		edge === 'left' ? 'left-0 -translate-x-1/2' : 'right-0 translate-x-1/2',
		className
	)}
	role="separator"
	tabindex="0"
	aria-label={label}
	aria-orientation="vertical"
	aria-valuemin={min}
	aria-valuemax={max}
	aria-valuenow={value}
	onkeydown={resizeWithKeyboard}
></div>
