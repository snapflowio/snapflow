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

interface SummaryRowProps {
	label: string;
	value?: string;
	detail?: string;
	children?: Snippet;
}

let { label, value, detail, children }: SummaryRowProps = $props();
</script>

<div class="flex items-center justify-between gap-4">
	<span class="shrink-0 text-(--text-body) text-small">{label}</span>
	{#if children}
		{@render children()}
	{:else}
		<span
			class="min-w-0 truncate text-right text-(--text-muted) text-small tabular-nums"
		>
			{value}
			{#if detail}
				<span class="text-(--text-subtle)"> · {detail}</span>
			{/if}
		</span>
	{/if}
</div>
