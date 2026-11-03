<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const FORK_TREE_INDENT_PIXELS = 16;
const FORK_TREE_BASE_PADDING_PIXELS = 8;
</script>

<script lang="ts">
import GitFork from '@lucide/svelte/icons/git-fork';
import type { Sandbox } from '@snapflow/api-client';
import ChevronDown from '#lib/components/icons/chevron-down.svelte';
import ChevronRight from '#lib/components/icons/chevron-right.svelte';
import Loader from '#lib/components/icons/loader.svelte';
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
import OverflowText from '#lib/components/ui/overflow/overflow-text.svelte';

interface SandboxTreeRowProps {
	canExpand?: boolean;
	current?: boolean;
	depth: number;
	expanded?: boolean;
	loading?: boolean;
	onToggle?: () => void;
	sandbox: Sandbox;
}

let {
	canExpand = false,
	current = false,
	depth,
	expanded = false,
	loading = false,
	onToggle,
	sandbox,
}: SandboxTreeRowProps = $props();
</script>

<div
	class={[
		'flex h-8 items-center gap-1.5 rounded-lg pr-2 transition-colors',
		current ? 'bg-surface-active' : 'hover-hover:bg-surface-hover',
	]}
	style:padding-left={`${depth * FORK_TREE_INDENT_PIXELS + FORK_TREE_BASE_PADDING_PIXELS}px`}
>
	<button
		type="button"
		class="flex size-4 shrink-0 cursor-pointer items-center justify-center text-(--text-icon) disabled:cursor-default"
		disabled={!canExpand || loading}
		onclick={onToggle}
		aria-label={`${expanded ? 'Collapse' : 'Expand'} forks of ${sandbox.name}`}
	>
		{#if loading}
			<Loader class="size-3 animate-spin" />
		{:else if canExpand && expanded}
			<ChevronDown class="size-3" />
		{:else if canExpand}
			<ChevronRight class="size-3" />
		{/if}
	</button>
	<GitFork class="size-3.5 shrink-0 text-(--text-icon)" />
	<OverflowText
		text={current ? `${sandbox.name} (current)` : sandbox.name}
		class="min-w-0 flex-1 text-(--text-body) text-small"
	/>
	{#if sandbox.state}
		<ResourceStateBadge state={sandbox.state} />
	{/if}
</div>
