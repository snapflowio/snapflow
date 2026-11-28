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
import StatusRing, {
	type StatusRingShape,
	type StatusRingTone,
} from './status-ring.svelte';

interface StatusLabelProps {
	label: string;
	shape: StatusRingShape;
	tone?: StatusRingTone;
	live?: boolean;
	description?: string | null;
	class?: ClassValue;
}

let {
	label,
	shape,
	tone = 'neutral',
	live = false,
	description,
	class: className,
}: StatusLabelProps = $props();
</script>

{#snippet content(extra: Record<string, unknown>)}
	<span
		{...extra}
		class={cn(
			'inline-flex min-w-0 items-center gap-2 text-(--text-primary) text-sm',
			className
		)}
	>
		<StatusRing {shape} {tone} {live} />
		<span class="truncate">{label}</span>
	</span>
{/snippet}

{#if description}
	<Tooltip content={description}>
		{#snippet child({ props })}
			{@render content({ ...props, tabindex: 0 })}
		{/snippet}
	</Tooltip>
{:else}
	{@render content({})}
{/if}
