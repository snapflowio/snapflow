<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { Snippet } from 'svelte';

interface ResourceStatProps {
	detail?: string | Snippet;
	label: string | Snippet;
	value: string | Snippet;
}

let { detail, label, value }: ResourceStatProps = $props();
</script>

{#snippet text(
	content: string | Snippet
)}
	{#if typeof content === 'string'}
		{content}
	{:else}
		{@render content()}
	{/if}
{/snippet}

<div class="flex min-w-0 flex-col bg-bg px-4 py-3">
	<dt class="truncate text-(--text-muted) text-small">{@render text(label)}</dt>
	<dd
		class="mt-1 flex min-h-7 items-center truncate text-(--text-body) text-lg tabular-nums"
	>
		{@render text(value)}
	</dd>
	{#if detail}
		<dd class="mt-0.5 truncate text-(--text-muted) text-caption">
			{@render text(detail)}
		</dd>
	{/if}
</div>
