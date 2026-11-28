<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import X from '@lucide/svelte/icons/x';
import type { ResourceFilterTag } from '#lib/components/resource/resource-options.ts';
import Chip from '#lib/components/ui/chip/chip.svelte';

interface ResourceFilterChipsProps {
	filterTags: readonly ResourceFilterTag[];
	onClearFilters?: () => void;
}

let { filterTags, onClearFilters }: ResourceFilterChipsProps = $props();
</script>

{#each filterTags as tag (`${tag.field}:${tag.value}`)}
	<span
		class="flex h-8 min-w-0 max-w-full shrink-0 items-center overflow-hidden rounded-full bg-surface-3"
	>
		<button
			type="button"
			class="flex h-full min-w-0 cursor-pointer items-center gap-2 pl-3 text-xs outline-none focus-visible:focus-ring-inset disabled:cursor-default"
			disabled={!tag.onSelect}
			onclick={tag.onSelect}
		>
			{#if tag.field}
				<span class="text-(--text-muted)">{tag.field}</span>
			{/if}
			<span class="truncate text-(--text-primary)">{tag.value}</span>
		</button>
		<button
			type="button"
			aria-label={`Remove ${tag.field ? `${tag.field} ` : ''}${tag.value} filter`}
			class="flex h-full shrink-0 cursor-pointer items-center pr-2.5 pl-1.5 text-(--text-subtle) outline-none hover-hover:text-(--text-primary) focus-visible:focus-ring-inset"
			onclick={tag.onRemove}
		>
			<X class="size-3.5" />
		</button>
	</span>
{/each}
{#if onClearFilters && filterTags.length > 0}
	<Chip size="compact" onclick={onClearFilters}>Clear all</Chip>
{/if}
