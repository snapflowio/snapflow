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

interface ResourceInfoSectionProps {
	title?: string;
	action?: Snippet;
	children: Snippet;
}

let { title, action, children }: ResourceInfoSectionProps = $props();

const titleId = $props.id();
</script>

<section
	aria-labelledby={title ? titleId : undefined}
	class="flex flex-col gap-1.5 border-border border-b px-4 py-3 last:border-b-0"
>
	{#if title || action}
		<div class="flex min-h-6 items-center gap-2">
			{#if title}
				<h3 id={titleId} class="text-(--text-muted) text-caption">{title}</h3>
			{/if}
			{#if action}
				<div class="ml-auto flex shrink-0 items-center gap-1">
					{@render action()}
				</div>
			{/if}
		</div>
	{/if}
	{@render children()}
</section>
