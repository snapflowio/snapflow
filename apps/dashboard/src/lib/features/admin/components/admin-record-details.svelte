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

export interface AdminRecordField {
	label: string;
	value?: string | null;
	mono?: boolean;
	content?: Snippet;
}

interface AdminRecordDetailsProps {
	summary: readonly AdminRecordField[];
	fields: readonly AdminRecordField[];
	notes?: readonly AdminRecordField[];
}

const EMPTY_VALUE = '—';
</script>

<script lang="ts">
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import { cn } from '#lib/utils/utils.ts';

let { summary, fields, notes = [] }: AdminRecordDetailsProps = $props();
</script>

{#snippet fieldValue(
	field: AdminRecordField
)}
	{#if field.content}
		{@render field.content()}
	{:else}
		<span class={cn(field.mono && 'font-mono')}
			>{field.value || EMPTY_VALUE}</span
		>
	{/if}
{/snippet}

<div class="flex flex-col gap-2.5 pt-1">
	<div class="grid grid-cols-2 gap-x-3 pb-0.5">
		{#each summary as field (field.label)}
			<div class="flex min-w-0 flex-col gap-0.5">
				<span class="text-(--text-tertiary) text-caption">{field.label}</span>
				<span class="min-w-0 truncate text-(--text-secondary) text-sm">
					{@render fieldValue(field)}
				</span>
			</div>
		{/each}
	</div>
	<KeyValueList>
		{#each fields as field (field.label)}
			<KeyValueRow>
				{#snippet label()}
					{field.label}
				{/snippet}
				{#snippet value()}
					{@render fieldValue(field)}
				{/snippet}
			</KeyValueRow>
		{/each}
	</KeyValueList>
	{#each notes as note (note.label)}
		{#if note.value}
			<div
				class="flex flex-col gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 py-2"
			>
				<span class="text-(--text-tertiary) text-caption">{note.label}</span>
				<p class="wrap-break-word text-(--text-secondary) text-small">
					{note.value}
				</p>
			</div>
		{/if}
	{/each}
</div>
