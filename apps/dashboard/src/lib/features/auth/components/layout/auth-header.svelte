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

interface AuthHeaderProps {
	title: string;
	description?: string | Snippet;
}

let { title, description }: AuthHeaderProps = $props();
</script>

<div class="space-y-1 text-center">
	<h1
		class="text-balance font-heading text-(--text-primary) text-[32px] leading-[1.2]"
	>
		{title}
	</h1>
	{#if description !== undefined}
		<p class="text-(--text-muted) text-base leading-[1.5]">
			{#if typeof description === 'string'}
				{description}
			{:else}
				{@render description()}
			{/if}
		</p>
	{/if}
</div>
