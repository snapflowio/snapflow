<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Lock from '@lucide/svelte/icons/lock';
import type { IconComponent } from '#lib/components/icons/icon-component.ts';
import Chip from '#lib/components/ui/chip/chip.svelte';
import Tooltip from '#lib/components/ui/tooltip/tooltip.svelte';
import { SIDEBAR_RAIL_CHIP_CLASS } from '#lib/features/dashboard/lib/sidebar-constants.ts';

interface SidebarNavChipProps {
	label: string;
	icon: IconComponent;
	href?: string;
	onSelect?: () => void;
	active?: boolean;
	restricted?: boolean;
	showTooltip: boolean;
}

let {
	label,
	icon,
	href,
	onSelect,
	active = false,
	restricted = false,
	showTooltip,
}: SidebarNavChipProps = $props();
</script>

<Tooltip content={label} disabled={!showTooltip}>
	{#snippet child({
		props,
	})}
		{#if href !== undefined}
			<Chip
				{...props}
				{href}
				leftIcon={icon}
				rightIcon={restricted ? Lock : undefined}
				aria-label={restricted ? `${label}: access required` : undefined}
				aria-current={active ? 'page' : undefined}
				{active}
				fullWidth
				class={SIDEBAR_RAIL_CHIP_CLASS}
			>
				{label}
			</Chip>
		{:else}
			<Chip
				{...props}
				leftIcon={icon}
				{active}
				fullWidth
				class={SIDEBAR_RAIL_CHIP_CLASS}
				onclick={onSelect}
			>
				{label}
			</Chip>
		{/if}
	{/snippet}
</Tooltip>
