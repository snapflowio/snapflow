<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

const scrollAreaClass =
	'min-h-0 overflow-x-hidden overflow-y-auto overscroll-y-contain';
const verticalScrollAreaClass =
	'min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain';
const SCROLL_AREA_GUTTER_CLASS = 'scrollbar-gutter-stable';
export const pageScrollAreaClass =
	'min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain scrollbar-gutter-both';
export const horizontalControlScrollAreaClass =
	'min-w-0 overflow-x-auto overscroll-x-contain scroll-px-2 scrollbar-none';
const SCROLL_AREA_AXIS_CLASS_NAMES = {
	both: scrollAreaClass,
	vertical: verticalScrollAreaClass,
} as const;
interface ScrollAreaProps
	extends Omit<
		HTMLAttributes<HTMLElement>,
		'aria-label' | 'children' | 'role' | 'tabindex'
	> {
	'aria-label': string;
	axis?: keyof typeof SCROLL_AREA_AXIS_CLASS_NAMES;
	gutter?: boolean;
	children: Snippet;
}
</script>

<script lang="ts">
import { cn } from '#lib/utils/utils.ts';

interface ScrollAreaComponentProps extends ScrollAreaProps {
	ref?: HTMLElement | null;
}

let {
	'aria-label': ariaLabel,
	axis = 'both',
	gutter = true,
	children,
	class: className,
	ref = $bindable(null),
	...props
}: ScrollAreaComponentProps = $props();
</script>

<section
	bind:this={ref}
	{...props}
	aria-label={ariaLabel}
	class={cn(
		SCROLL_AREA_AXIS_CLASS_NAMES[axis],
		gutter && SCROLL_AREA_GUTTER_CLASS,
		className
	)}
>
	{@render children()}
</section>
