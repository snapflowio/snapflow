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

interface ChipModalReviewRowProps {
	label: string;
	value: string | number | Snippet;
}

let { label, value }: ChipModalReviewRowProps = $props();
</script>

<div class="flex min-h-8 items-center justify-between gap-4 py-1.5">
	<dt class="text-(--text-muted) text-caption">{label}</dt>
	<dd class="min-w-0 truncate text-right text-(--text-primary) text-small">
		{#if typeof value === 'function'}
			{@render value()}
		{:else}
			{value}
		{/if}
	</dd>
</div>
