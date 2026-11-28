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
import type { ClassValue } from 'svelte/elements';
import { cn } from '#lib/utils/utils.ts';
import TableFooter from './table-footer.svelte';

interface TableFrameProps {
	footer?: string | null;
	children: Snippet;
	class?: ClassValue;
}

let { footer, children, class: className }: TableFrameProps = $props();
</script>

<div
	class={cn(
		'relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border',
		className
	)}
>
	{@render children()}
	{#if footer}
		<TableFooter label={footer} />
	{/if}
</div>
