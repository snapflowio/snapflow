<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
interface SidebarMenuTriggerProps {
	name: string;
	label: string;
	busy?: boolean;
}
</script>

<script lang="ts">
import ChevronDown from '@lucide/svelte/icons/chevron-down';
import { mergeProps } from 'bits-ui';
import DropdownMenuTrigger from '#lib/components/ui/dropdown-menu/dropdown-menu-trigger.svelte';
import { SIDEBAR_MENU_TRIGGER_CLASS } from '#lib/features/dashboard/lib/sidebar-constants.ts';
import SidebarAvatar from './sidebar-avatar.svelte';
import SidebarTooltip from './sidebar-tooltip.svelte';

let { name, label, busy = false }: SidebarMenuTriggerProps = $props();
</script>

<DropdownMenuTrigger>
	{#snippet child({ props: menuProps })}
		<SidebarTooltip label={name}>
			{#snippet child({ props: tooltipProps })}
				<button
					{...mergeProps(menuProps, tooltipProps)}
					type="button"
					aria-label={label}
					aria-busy={busy || undefined}
					class={SIDEBAR_MENU_TRIGGER_CLASS}
				>
					<SidebarAvatar {name} />
					<span class="min-w-0 truncate">{name}</span>
					<ChevronDown
						aria-hidden="true"
						class="ml-auto size-4 shrink-0 text-(--text-subtle)"
					/>
				</button>
			{/snippet}
		</SidebarTooltip>
	{/snippet}
</DropdownMenuTrigger>
