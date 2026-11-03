<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { Snippet } from 'svelte';

export interface ResourcePanelHeaderProps {
	actions?: Snippet;
	description?: string;
	id?: string;
	title: string;
}
</script>

<script lang="ts">
let { actions, description, id, title }: ResourcePanelHeaderProps = $props();
</script>

<div
	class="flex min-h-10 shrink-0 items-center gap-3 border-border border-b px-4 py-1.5"
>
	<div class="flex min-w-0 flex-1 items-baseline gap-2">
		<h2 {id} class="shrink-0 text-(--text-body) text-sm">
			{title}
		</h2>
		{#if description}
			<p class="min-w-0 truncate text-(--text-muted) text-caption">
				{description}
			</p>
		{/if}
	</div>
	{#if actions}
		<div class="flex shrink-0 items-center gap-1">{@render actions()}</div>
	{/if}
</div>
