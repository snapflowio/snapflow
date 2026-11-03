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
import { cn } from '#lib/utils/utils.ts';

interface AdminSettingRowProps {
	label: string;
	caption?: string;
	error?: string;
	for?: string;
	stacked?: boolean;
	children: Snippet;
}

let {
	label,
	caption,
	error: errorText,
	for: controlId,
	stacked = false,
	children,
}: AdminSettingRowProps = $props();

const messageId = $props.id();
</script>

<div
	class={cn(
		'flex flex-col gap-2',
		!stacked && 'md:flex-row md:items-center md:justify-between md:gap-4'
	)}
>
	<div class="flex min-w-0 flex-col gap-1">
		<Label for={controlId}>{label}</Label>
		{#if errorText}
			<p id={messageId} role="alert" class="text-(--text-error) text-caption">
				{errorText}
			</p>
		{:else if caption}
			<p id={messageId} class="text-(--text-muted) text-caption">{caption}</p>
		{/if}
	</div>
	<div class={cn('w-full shrink-0', !stacked && 'md:w-60')}>
		{@render children()}
	</div>
</div>
