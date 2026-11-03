<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
export interface ResourceTab {
	label: string;
	href: string;
	active: boolean;
}
</script>

<script lang="ts">
import type { ClassValue } from 'svelte/elements';
import Chip from '#lib/components/ui/chip/chip.svelte';
import { cn } from '#lib/utils/utils.ts';

interface ResourceTabsProps {
	tabs: readonly ResourceTab[];
	label: string;
	class?: ClassValue;
}

let { tabs, label, class: className }: ResourceTabsProps = $props();
</script>

<nav
	aria-label={label}
	class={cn(
		'flex min-w-0 items-center gap-1 overflow-x-auto scrollbar-none',
		className
	)}
>
	{#each tabs as tab (tab.href)}
		<Chip
			href={tab.href}
			active={tab.active}
			aria-current={tab.active ? 'page' : undefined}
			class="shrink-0"
		>
			{tab.label}
		</Chip>
	{/each}
</nav>
