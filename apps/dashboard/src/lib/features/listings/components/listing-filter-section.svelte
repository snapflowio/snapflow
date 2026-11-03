<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ChevronDown from '@lucide/svelte/icons/chevron-down';
import { Collapsible } from 'bits-ui';
import type { Snippet } from 'svelte';
import { disclosureChevronClass } from '#lib/components/ui/chip/chip-chrome.ts';
import { cn } from '#lib/utils/utils.ts';

interface ListingFilterSectionProps {
	title: string;
	children: Snippet;
}

let { title, children }: ListingFilterSectionProps = $props();

let open = $state(true);
</script>

<Collapsible.Root bind:open class="group/section flex flex-col">
	<div class="flex h-4.5 shrink-0 items-center max-md:pointer-coarse:h-11">
		<Collapsible.Trigger
			class="group/toggle flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2 px-4 outline-none"
		>
			<span class="truncate text-(--text-muted) text-caption">{title}</span>
			<ChevronDown
				class={cn(
					disclosureChevronClass,
					'opacity-0 group-hover/section:opacity-100 group-focus-visible/toggle:opacity-100 max-md:pointer-coarse:opacity-100',
					!open && '-rotate-90'
				)}
			/>
		</Collapsible.Trigger>
	</div>
	<Collapsible.Content
		class="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down"
	>
		<div class="flex flex-col gap-3 px-4 pt-1.5">
			{@render children()}
		</div>
	</Collapsible.Content>
</Collapsible.Root>
