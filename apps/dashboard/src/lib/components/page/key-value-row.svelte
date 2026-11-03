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
import { cn } from '#lib/utils/utils.ts';

interface KeyValueRowProps {
	action?: Snippet;
	detail?: Snippet;
	label: Snippet;
	value: Snippet;
}

let { action, detail, label, value }: KeyValueRowProps = $props();
</script>

<div
	class={cn(
		'flex min-h-10 min-w-0 items-center justify-between gap-3 px-3 py-2',
		detail && 'items-start'
	)}
>
	<dt class="shrink-0 text-(--text-tertiary) text-caption">
		{@render label()}
	</dt>
	<dd class="flex min-w-0 items-center justify-end gap-2 text-right">
		<div class="min-w-0">
			<div class="wrap-break-word text-(--text-body) text-small">
				{@render value()}
			</div>
			{#if detail}
				<div class="mt-0.5 break-all text-(--text-muted) text-caption">
					{@render detail()}
				</div>
			{/if}
		</div>
		{#if action}
			<div class="shrink-0">{@render action()}</div>
		{/if}
	</dd>
</div>
