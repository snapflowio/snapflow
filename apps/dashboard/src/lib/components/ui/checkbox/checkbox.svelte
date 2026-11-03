<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { cva } from 'class-variance-authority';

const checkboxVariants = cva(
	[
		'relative peer flex shrink-0 cursor-pointer items-center justify-center rounded-sm border transition-colors',
		'border-border bg-transparent',
		'before:absolute before:-inset-3 before:content-[""]',
		'focus-visible:outline-none',
		'data-disabled:cursor-not-allowed data-disabled:opacity-50',
		'data-[state=checked]:border-(--text-primary) data-[state=checked]:bg-(--text-primary)',
		'data-[state=indeterminate]:border-(--text-primary) data-[state=indeterminate]:bg-(--text-primary)',
	].join(' '),
	{
		variants: {
			size: {
				sm: 'h-3.5 w-3.5',
				md: 'h-4 w-4',
				lg: 'h-5 w-5',
			},
		},
		defaultVariants: {
			size: 'md',
		},
	}
);
const checkboxIconVariants = cva('stroke-3', {
	variants: {
		size: {
			sm: 'h-2.5 w-2.5',
			md: 'h-3.5 w-3.5',
			lg: 'h-4 w-4',
		},
	},
	defaultVariants: {
		size: 'md',
	},
});
</script>

<script lang="ts">
import Check from '@lucide/svelte/icons/check';
import Minus from '@lucide/svelte/icons/minus';
import { Checkbox as CheckboxPrimitive } from 'bits-ui';
import type { VariantProps } from 'class-variance-authority';
import { cn } from '#lib/utils/utils.ts';

const INDETERMINATE = 'indeterminate';

interface CheckboxProps
	extends Omit<
			CheckboxPrimitive.RootProps,
			'checked' | 'indeterminate' | 'children' | 'child'
		>,
		VariantProps<typeof checkboxVariants> {
	checked?: boolean | typeof INDETERMINATE;
}

let {
	class: className,
	size,
	checked = false,
	ref = $bindable(null),
	...props
}: CheckboxProps = $props();
</script>

<CheckboxPrimitive.Root
	bind:ref
	class={cn(checkboxVariants({ size }), className)}
	checked={checked === true}
	indeterminate={checked === INDETERMINATE}
	{...props}
>
	{#snippet children({
		checked: isChecked,
		indeterminate: isIndeterminate,
	})}
		{#if isChecked || isIndeterminate}
			<span class="flex items-center justify-center text-(--text-inverse)">
				{#if isIndeterminate}
					<Minus class={cn(checkboxIconVariants({ size }))} />
				{:else}
					<Check class={cn(checkboxIconVariants({ size }))} />
				{/if}
			</span>
		{/if}
	{/snippet}
</CheckboxPrimitive.Root>
