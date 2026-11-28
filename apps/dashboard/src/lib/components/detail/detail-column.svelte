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

interface DetailColumnProps {
	title?: string;
	children: Snippet;
}

let { title, children }: DetailColumnProps = $props();
</script>

<div class="flex min-w-0 flex-col gap-y-4">
	{#if title}
		<h4 class="text-(--text-primary) text-sm">{title}</h4>
	{/if}
	<dl class="flex flex-col">
		{@render children()}
	</dl>
</div>
