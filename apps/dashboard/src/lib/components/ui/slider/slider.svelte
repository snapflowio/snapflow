<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { Slider as SliderPrimitive } from 'bits-ui';
import { cn } from '#lib/utils/utils.ts';

type SliderProps = Omit<
	Extract<SliderPrimitive.RootProps, { type: 'single' }>,
	'type' | 'child' | 'children'
>;

let {
	class: className,
	value = $bindable(0),
	ref = $bindable(null),
	'aria-label': ariaLabel,
	'aria-labelledby': ariaLabelledby,
	...props
}: SliderProps = $props();
</script>

<SliderPrimitive.Root
	bind:ref
	bind:value
	type="single"
	class={cn(
		'relative flex h-5 w-full touch-none select-none items-center data-disabled:cursor-not-allowed data-disabled:opacity-50',
		className
	)}
	{...props}
>
	<span
		class="relative h-1 w-full grow overflow-hidden rounded-full bg-surface-5"
	>
		<SliderPrimitive.Range class="absolute h-full bg-(--text-primary)" />
	</span>
	<SliderPrimitive.Thumb
		index={0}
		aria-label={ariaLabel}
		aria-labelledby={ariaLabelledby}
		class="block size-4 cursor-grab rounded-full bg-(--text-primary) shadow-(--shadow-raised) transition-colors focus-visible:focus-ring active:cursor-grabbing data-disabled:cursor-not-allowed"
	/>
</SliderPrimitive.Root>
