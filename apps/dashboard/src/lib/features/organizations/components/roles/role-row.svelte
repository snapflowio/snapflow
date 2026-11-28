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
import type { ScopeResource } from '#lib/features/organizations/lib/organization-resources.ts';

interface RoleRowProps {
	title: string;
	summary: string | null;
	scopes: readonly ScopeResource[];
	actions?: readonly ResourceRowAction[];
}

const NO_PERMISSIONS_LABEL = 'No extra permissions';
</script>

<script lang="ts">
import ChevronDown from '@lucide/svelte/icons/chevron-down';
import UserCog from '@lucide/svelte/icons/user-cog';
import { Collapsible } from 'bits-ui';
import ResourceRowActions from '#lib/components/resource/resource-row-actions.svelte';
import { disclosureChevronClass } from '#lib/components/ui/chip/chip-chrome.ts';
import { cn } from '#lib/utils/utils.ts';

let { title, summary, scopes, actions }: RoleRowProps = $props();

let open = $state(false);
const expandable = $derived(scopes.length > 0);
</script>

<Collapsible.Root
	bind:open
	disabled={!expandable}
	data-settings-row=""
	class="flex flex-col"
>
	<div class="flex items-center justify-between gap-4">
		<Collapsible.Trigger
			class="group/toggle -my-1 flex min-w-0 flex-1 items-center gap-4 rounded-lg py-1 text-left outline-none focus-visible:focus-ring enabled:cursor-pointer"
		>
			<UserCog class="size-4 shrink-0 text-(--text-muted)" />
			<span class="flex min-w-0 flex-1 flex-col gap-1">
				<span class="truncate font-medium text-(--text-primary) text-sm">
					{title}
				</span>
				<span class="truncate text-(--text-muted) text-sm">
					{summary ?? NO_PERMISSIONS_LABEL}
				</span>
			</span>
			{#if expandable}
				<ChevronDown
					class={cn(
						disclosureChevronClass,
						'group-hover/toggle:text-(--text-primary)',
						!open && '-rotate-90'
					)}
				/>
			{/if}
		</Collapsible.Trigger>
		{#if actions && actions.length > 0}
			<ResourceRowActions
				reveal="always"
				label={`${title} actions`}
				{actions}
			/>
		{/if}
	</div>
	<Collapsible.Content
		class="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down"
	>
		<dl
			class="mt-4 ml-8 grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-8 gap-y-2 text-sm leading-5"
		>
			{#each scopes as scope (scope.resource)}
				<dt class="text-(--text-muted)">{scope.label}</dt>
				<dd class="min-w-0 text-(--text-primary) first-letter:uppercase">
					{scope.actions.join(', ')}
				</dd>
			{/each}
		</dl>
	</Collapsible.Content>
</Collapsible.Root>
