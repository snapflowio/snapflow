<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { ClassValue } from 'svelte/elements';
import Tooltip from '#lib/components/ui/tooltip/tooltip.svelte';
import { cn } from '#lib/utils/utils.ts';
import { observeOverflow } from './overflow-fade.ts';

interface OverflowTextProps {
	text: string;
	class?: ClassValue;
}

let { text, class: className }: OverflowTextProps = $props();

let overflowing = $state(false);

function track(element: HTMLElement) {
	return observeOverflow(element, (next) => {
		overflowing = next;
	});
}
</script>

<Tooltip content={text} disabled={!overflowing}>
	{#snippet child({
		props,
	})}
		<span
			{...props}
			{@attach track}
			class={cn(
				'block min-w-0 overflow-hidden text-clip whitespace-nowrap',
				overflowing && 'overflow-fade',
				className
			)}
		>
			{text}
		</span>
	{/snippet}
</Tooltip>
