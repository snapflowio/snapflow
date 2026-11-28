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
import { scrollEdges } from '#lib/components/ui/overflow/scroll-fade.ts';
import { cn } from '#lib/utils/utils.ts';
import { findChipModalVariant } from './chip-modal-variant.ts';

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

const variant = findChipModalVariant();
const sheet = $derived(variant() === 'sheet');
const scrolls = $derived(!fullBleed);
</script>

<div
	bind:this={ref}
	class={cn(
		'peer/chip-modal-body flex min-h-0 min-w-0 w-full flex-1 flex-col',
		fullBleed && 'overflow-hidden',
		scrolls && 'overflow-y-auto overflow-x-hidden overscroll-contain',
		scrolls && (sheet ? 'gap-y-6 px-8 pb-8' : 'scroll-fade gap-6 p-6'),
		className
	)}
	{@attach scrolls ? scrollEdges() : undefined}
	{...rest}
>
	{@render children?.()}
</div>
