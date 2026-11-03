<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import { cn } from '#lib/utils/utils.ts';

interface ChipModalBodyProps extends HTMLAttributes<HTMLDivElement> {
	fullBleed?: boolean;
	ref?: HTMLDivElement | null;
}

let {
	class: className,
	fullBleed = false,
	children,
	ref = $bindable(null),
	...rest
}: ChipModalBodyProps = $props();
</script>

<div
	bind:this={ref}
	class={cn(
		'flex min-h-0 min-w-0 w-full flex-1 flex-col',
		fullBleed
			? 'overflow-hidden'
			: 'gap-4 overflow-y-auto overflow-x-hidden px-2 pt-4 pb-4.5',
		className
	)}
	{...rest}
>
	{@render children?.()}
</div>
