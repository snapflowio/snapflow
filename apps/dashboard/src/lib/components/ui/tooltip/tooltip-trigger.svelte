<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import { mergeProps } from 'bits-ui';
import type { Snippet } from 'svelte';
import { createAttachmentKey } from 'svelte/attachments';
import type { HTMLButtonAttributes } from 'svelte/elements';
import { getTooltip } from './floating-tooltip.svelte.ts';

interface TooltipTriggerProps extends HTMLButtonAttributes {
	child?: Snippet<[{ props: Record<string, unknown> }]>;
	ref?: HTMLButtonElement | null;
}

let {
	child,
	children,
	ref = $bindable(null),
	...rest
}: TooltipTriggerProps = $props();

const tooltip = getTooltip();
const trackKey = createAttachmentKey();

const triggerProps = $derived(
	mergeProps({ 'aria-describedby': tooltip.describedBy }, rest, {
		[trackKey]: tooltip.track,
	})
);
</script>

{#if child}
	{@render child({ props: triggerProps })}
{:else}
	<button bind:this={ref} type="button" {...triggerProps}>
		{@render children?.()}
	</button>
{/if}
