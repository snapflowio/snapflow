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
import type { HTMLButtonAttributes } from 'svelte/elements';

interface CalendarDayCellProps extends HTMLButtonAttributes {
	selected?: boolean;
	today?: boolean;
	fullWidth?: boolean;
	children: Snippet;
	ref?: HTMLButtonElement | null;
}
</script>

<script lang="ts">
import { chipVariants } from '#lib/components/ui/chip/chip.svelte';
import { cn } from '#lib/utils/utils.ts';

let {
	selected = false,
	today = false,
	fullWidth = false,
	class: className,
	children,
	type,
	ref = $bindable(null),
	...rest
}: CalendarDayCellProps = $props();

const variant = $derived.by(() => {
	if (selected) return 'primary';
	if (today) return 'outline';
	return undefined;
});
</script>

<button
	bind:this={ref}
	type={type ?? 'button'}
	class={cn(
		chipVariants({ variant }),
		'justify-center p-0 font-normal text-sm',
		fullWidth ? 'h-8 w-full' : 'size-8',
		!selected && 'text-(--text-body)',
		className
	)}
	{...rest}
>
	{@render children()}
</button>
