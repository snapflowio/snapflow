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

export interface TooltipProps {
	content: string | Snippet;
	shortcut?: string;
	disabled?: boolean;
	preferAbove?: boolean;
	child: Snippet<[{ props: Record<string, unknown> }]>;
}

const NO_PROPS: Record<string, unknown> = {};
</script>

<script lang="ts">
import TooltipContent from './tooltip-content.svelte';
import TooltipRoot from './tooltip-root.svelte';
import TooltipShortcut from './tooltip-shortcut.svelte';
import TooltipTrigger from './tooltip-trigger.svelte';

let {
	content,
	shortcut,
	disabled = false,
	preferAbove = false,
	child: renderChild,
}: TooltipProps = $props();
</script>

{#snippet label()}
	{#if typeof content === 'string'}
		{content}
	{:else}
		{@render content()}
	{/if}
{/snippet}

{#if disabled}
	{@render renderChild({ props: NO_PROPS })}
{:else}
	<TooltipRoot {preferAbove}>
		<TooltipTrigger>
			{#snippet child({
				props,
			})}
				{@render renderChild({ props })}
			{/snippet}
		</TooltipTrigger>
		<TooltipContent>
			{#if shortcut}
				<TooltipShortcut keys={shortcut}>{@render label()}</TooltipShortcut>
			{:else}
				{@render label()}
			{/if}
		</TooltipContent>
	</TooltipRoot>
{/if}
