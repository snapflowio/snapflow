<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { SnapshotDto } from '@snapflow/api-client';
import { gpuTypeLabel } from '#lib/features/machines/lib/gpu-options.ts';

const SIZE_FRACTION_DIGITS = 2;

interface DetailCopy {
	code: string;
	label: string;
}

function snapshotResourcesLabel(snapshot: SnapshotDto): string {
	const base = `${snapshot.cpu} CPU · ${snapshot.mem} GiB RAM · ${snapshot.disk} GiB disk`;
	if (snapshot.gpu <= 0) return base;
	const gpuLabel = snapshot.gpuType ? gpuTypeLabel(snapshot.gpuType) : 'GPU';
	return `${base} · ${snapshot.gpu} ${gpuLabel}`;
}

function snapshotImageLabel(snapshot: SnapshotDto): string {
	if (snapshot.imageName) return snapshot.imageName;
	return snapshot.buildInfo ? 'Declarative build' : '—';
}
</script>

<script lang="ts">
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import CopyCodeButton from '#lib/components/ui/clipboard/copy-code-button.svelte';
import {
	formatDateTime,
	formatGibibytes,
	formatOptionalDateTime,
} from '#lib/utils/format.ts';

interface SnapshotDetailsBodyProps {
	snapshot: SnapshotDto;
}

let { snapshot }: SnapshotDetailsBodyProps = $props();

const entrypoint = $derived(snapshot.entrypoint?.join(' ') ?? '');
</script>

{#snippet textRow(
	rowLabel: string,
	rowValue: string,
	valueClass?: string,
	copy?: DetailCopy
)}
	<KeyValueRow action={copy ? rowAction : undefined}>
		{#snippet label()}
			{rowLabel}
		{/snippet}
		{#snippet value()}
			<span class={['block', valueClass]}>{rowValue}</span>
		{/snippet}
	</KeyValueRow>
	{#snippet rowAction()}
		{#if copy}
			<CopyCodeButton code={copy.code} label={copy.label} />
		{/if}
	{/snippet}
{/snippet}

{#snippet summaryItem(
	itemLabel: string,
	itemValue: string,
	valueClass?: string
)}
	<div class="flex min-w-0 flex-col gap-0.5">
		<span class="text-(--text-tertiary) text-caption">{itemLabel}</span>
		<span
			class={[
				'truncate text-(--text-secondary) text-sm tabular-nums',
				valueClass,
			]}
		>
			{itemValue}
		</span>
	</div>
{/snippet}

<div class="flex flex-col gap-2.5 pb-4">
	<div class="grid grid-cols-2 gap-x-3 pb-0.5">
		{@render summaryItem('Created', formatDateTime(snapshot.createdAt))}
		{@render summaryItem('Image', snapshotImageLabel(snapshot), 'font-mono')}
	</div>
	<KeyValueList>
		{@render textRow('Snapshot ID', snapshot.id, 'font-mono', {
			code: snapshot.id,
			label: 'Copy snapshot ID',
		})}
		<KeyValueRow>
			{#snippet label()}
				State
			{/snippet}
			{#snippet value()}
				<ResourceStateBadge
					errorReason={snapshot.errorReason}
					state={snapshot.state}
				/>
			{/snippet}
		</KeyValueRow>
		{#if snapshot.imageName}
			{@render textRow('Image', snapshot.imageName, 'font-mono', {
				code: snapshot.imageName,
				label: 'Copy image',
			})}
		{/if}
		{@render textRow(
			'Entrypoint',
			entrypoint || 'Default',
			'font-mono',
			entrypoint ? { code: entrypoint, label: 'Copy entrypoint' } : undefined
		)}
		{@render textRow('Resources', snapshotResourcesLabel(snapshot))}
		{@render textRow(
			'Size',
			snapshot.size === null
				? 'Pending'
				: formatGibibytes(snapshot.size, SIZE_FRACTION_DIGITS)
		)}
		{@render textRow('Class', snapshot.sandboxClass ?? 'Container')}
		{#if snapshot.general}
			<KeyValueRow>
				{#snippet label()}
					Type
				{/snippet}
				{#snippet value()}
					<Badge variant="gray-secondary">System</Badge>
				{/snippet}
			</KeyValueRow>
		{/if}
		{@render textRow('Updated', formatDateTime(snapshot.updatedAt))}
		{@render textRow(
			'Last used',
			formatOptionalDateTime(snapshot.lastUsedAt, 'Never')
		)}
	</KeyValueList>
	{#if snapshot.errorReason}
		<div
			role="alert"
			class="flex flex-col gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 py-2"
		>
			<span class="text-(--text-tertiary) text-caption">Build error</span>
			<p class="wrap-break-word text-(--text-error) text-caption">
				{snapshot.errorReason}
			</p>
		</div>
	{/if}
	{#if snapshot.buildInfo}
		{const buildInfo = $derived(snapshot.buildInfo)}
		<KeyValueList>
			{@render textRow('Build created', formatDateTime(buildInfo.createdAt))}
			{@render textRow('Build updated', formatDateTime(buildInfo.updatedAt))}
			{#each buildInfo.contextHashes ?? [] as hash, index (`${hash}-${index}`)}
				{@render textRow(
					index === 0 ? 'Context hashes' : '',
					hash,
					'break-all font-mono',
					{
						code: hash,
						label: 'Copy context hash',
					}
				)}
			{/each}
		</KeyValueList>
		{#if buildInfo.dockerfileContent}
			<div
				class="flex min-w-0 flex-col gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 py-2"
			>
				<span class="text-(--text-tertiary) text-caption">Dockerfile</span>
				<pre
					class="max-h-75 overflow-x-hidden overflow-y-auto whitespace-pre-wrap wrap-break-word font-mono text-(--text-secondary) text-caption"
				>{buildInfo.dockerfileContent}</pre>
			</div>
		{/if}
	{/if}
</div>
