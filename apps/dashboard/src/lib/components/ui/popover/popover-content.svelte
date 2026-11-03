<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const POPOVER_SIDE_OFFSET = 6;
const POPOVER_COLLISION_PADDING = 8;
</script>

<script lang="ts">
import { type PopoverContentProps, Popover as PopoverPrimitive } from 'bits-ui';
import {
	POPOVER_ANIMATION_CLASS,
	POPOVER_SURFACE_CLASS,
} from '#lib/components/ui/chip/chip-chrome.ts';
import { cn } from '#lib/utils/utils.ts';

let {
	class: className,
	side = 'bottom',
	align = 'start',
	sideOffset = POPOVER_SIDE_OFFSET,
	collisionPadding = POPOVER_COLLISION_PADDING,
	ref = $bindable(null),
	...rest
}: PopoverContentProps = $props();
</script>

<PopoverPrimitive.Portal>
	<PopoverPrimitive.Content
		bind:ref
		{side}
		{align}
		{sideOffset}
		{collisionPadding}
		class={cn(
			POPOVER_ANIMATION_CLASS,
			POPOVER_SURFACE_CLASS,
			'z-(--z-popover) max-h-100 min-w-40 origin-(--bits-popover-content-transform-origin) overflow-y-auto p-1',
			className
		)}
		{...rest}
		data-native-surface-overlay=""
	/>
</PopoverPrimitive.Portal>
