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
import Label from '#lib/components/ui/label.svelte';

interface AuthFieldProps {
	id: string;
	label: string;
	errors?: readonly string[];
	action?: Snippet;
	children: Snippet;
}

let { id, label, errors = [], action, children }: AuthFieldProps = $props();
</script>

<div class="space-y-2">
	<div class="flex items-center justify-between">
		<Label for={id}>{label}</Label>
		{@render action?.()}
	</div>
	{@render children()}
	{#if errors.length > 0}
		<div class="space-y-1 text-(--text-error) text-caption" aria-live="polite">
			{#each errors as message (message)}
				<p>{message}</p>
			{/each}
		</div>
	{/if}
</div>
