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

interface SidebarTooltipProps {
	label: string;
	child: Snippet<[{ props: Record<string, unknown> }]>;
}
</script>

<script lang="ts">
import TooltipContent from '#lib/components/ui/tooltip/tooltip-content.svelte';
import TooltipRoot from '#lib/components/ui/tooltip/tooltip-root.svelte';
import TooltipTrigger from '#lib/components/ui/tooltip/tooltip-trigger.svelte';
import { getSidebar } from '#lib/features/dashboard/state/sidebar.svelte.ts';

let { label, child: renderChild }: SidebarTooltipProps = $props();

const sidebar = getSidebar();
</script>

<TooltipRoot>
	<TooltipTrigger>
		{#snippet child({ props })}
			{@render renderChild({ props })}
		{/snippet}
	</TooltipTrigger>
	{#if sidebar.collapsed}
		<TooltipContent>{label}</TooltipContent>
	{/if}
</TooltipRoot>
