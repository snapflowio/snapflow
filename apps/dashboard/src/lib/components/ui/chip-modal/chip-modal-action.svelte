<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Chip, { type ChipProps } from '#lib/components/ui/chip/chip.svelte';
import TooltipContent from '#lib/components/ui/tooltip/tooltip-content.svelte';
import TooltipRoot from '#lib/components/ui/tooltip/tooltip-root.svelte';
import TooltipTrigger from '#lib/components/ui/tooltip/tooltip-trigger.svelte';
import { cn } from '#lib/utils/utils.ts';

type ChipModalActionProps = ChipProps & {
	disabledTooltip?: string;
};

let {
	disabledTooltip,
	disabled,
	class: className,
	...rest
}: ChipModalActionProps = $props();

const showsDisabledTooltip = $derived(Boolean(disabled && disabledTooltip));
</script>

{#if showsDisabledTooltip}
	<TooltipRoot>
		<TooltipTrigger>
			{#snippet child({
				props,
			})}
				<span {...props} class="inline-flex cursor-not-allowed">
					<Chip
						{...rest}
						{disabled}
						class={cn('pointer-events-none', className)}
					/>
				</span>
			{/snippet}
		</TooltipTrigger>
		<TooltipContent>{disabledTooltip}</TooltipContent>
	</TooltipRoot>
{:else}
	<Chip {...rest} {disabled} class={className} />
{/if}
