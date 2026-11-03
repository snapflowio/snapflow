<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
const ROW_CLASS =
	'flex w-full min-w-0 items-center gap-2.5 rounded-lg p-2 text-left';
const INTERACTIVE_ROW_CLASS =
	'cursor-pointer outline-none transition-colors hover-hover:bg-surface-active focus-visible:bg-surface-active';
</script>

<script lang="ts">
import ArrowRight from '@lucide/svelte/icons/arrow-right';
import type { Snippet } from 'svelte';

interface UsageRowProps {
	href?: string;
	onSelect?: () => void;
	selectLabel?: string;
	children: Snippet;
}

let { href, onSelect, selectLabel, children }: UsageRowProps = $props();
</script>

{#snippet arrow()}
	<ArrowRight aria-hidden="true" class="size-4 shrink-0 text-(--text-icon)" />
{/snippet}

<li class="flex">
	{#if href}
		<a
			{href}
			aria-label={selectLabel}
			class={[ROW_CLASS, INTERACTIVE_ROW_CLASS]}
		>
			{@render children()}
			{@render arrow()}
		</a>
	{:else if onSelect}
		<button
			type="button"
			aria-label={selectLabel}
			onclick={onSelect}
			class={[ROW_CLASS, INTERACTIVE_ROW_CLASS]}
		>
			{@render children()}
			{@render arrow()}
		</button>
	{:else}
		<div class={ROW_CLASS}>{@render children()}</div>
	{/if}
</li>
