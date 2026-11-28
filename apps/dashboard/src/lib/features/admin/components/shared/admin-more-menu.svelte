<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { ResourceRowAction } from '#lib/components/resource/resource-row-action.ts';

interface AdminMoreMenuProps {
	label: string;
	actions: readonly ResourceRowAction[];
}

const MENU_SIDE_OFFSET = 4;
</script>

<script lang="ts">
import Ellipsis from '@lucide/svelte/icons/ellipsis';
import { hasVisibleRowActions } from '#lib/components/resource/resource-row-action.ts';
import ResourceRowActionItems from '#lib/components/resource/resource-row-action-items.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import DropdownMenu from '#lib/components/ui/dropdown-menu/dropdown-menu.svelte';
import DropdownMenuContent from '#lib/components/ui/dropdown-menu/dropdown-menu-content.svelte';
import DropdownMenuTrigger from '#lib/components/ui/dropdown-menu/dropdown-menu-trigger.svelte';

let { label, actions }: AdminMoreMenuProps = $props();
</script>

{#if hasVisibleRowActions(actions)}
	<DropdownMenu>
		<DropdownMenuTrigger>
			{#snippet child({ props })}
				<Chip
					{...props}
					variant="secondary"
					leftIcon={Ellipsis}
					aria-label={label}
					class="w-10 gap-0 px-0"
				/>
			{/snippet}
		</DropdownMenuTrigger>
		<DropdownMenuContent align="end" sideOffset={MENU_SIDE_OFFSET}>
			<ResourceRowActionItems {actions} />
		</DropdownMenuContent>
	</DropdownMenu>
{/if}
