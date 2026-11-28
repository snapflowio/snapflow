<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import ChevronRight from '@lucide/svelte/icons/chevron-right';
import type { Snippet } from 'svelte';
import { cn } from '#lib/utils/utils.ts';

interface DetailDisclosureProps {
	showLabel: string;
	hideLabel: string;
	children: Snippet;
}

let { showLabel, hideLabel, children }: DetailDisclosureProps = $props();

const contentId = $props.id();
let open = $state(false);
</script>

<div class="flex flex-col">
	<button
		type="button"
		aria-expanded={open}
		aria-controls={contentId}
		class="flex h-8 w-fit cursor-pointer items-center gap-1.5 rounded-md text-(--text-muted) text-sm outline-none transition-colors duration-(--motion-quick) hover-hover:text-(--text-primary) focus-visible:focus-ring"
		onclick={() => (open = !open)}
	>
		<ChevronRight
			class={cn(
				'size-4 transition-transform duration-(--motion-quick) motion-reduce:transition-none',
				open && 'rotate-90'
			)}
		/>
		{open ? hideLabel : showLabel}
	</button>
	<div
		id={contentId}
		class={cn(
			'grid transition-[grid-template-rows] duration-(--motion-standard) ease-(--ease-standard) motion-reduce:transition-none',
			open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
		)}
		inert={!open}
	>
		<div class="min-h-0 overflow-hidden">
			<div class="mt-2">{@render children()}</div>
		</div>
	</div>
</div>
