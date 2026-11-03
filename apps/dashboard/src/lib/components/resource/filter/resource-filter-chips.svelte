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

{#each filterTags as tag (tag.label)}
	<Chip onclick={tag.onRemove} rightIcon={X}>{tag.label}</Chip>
{/each}
{#if onClearFilters && filterTags.length > 0}
	<Chip onclick={onClearFilters}>Clear all</Chip>
{/if}
