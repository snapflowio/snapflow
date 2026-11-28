<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { type SnapshotDto, SnapshotState } from '@snapflow/api-client';
import { gpuTypeLabel } from '#lib/features/machines/lib/gpu-options.ts';
import { sandboxClassLabel } from '#lib/features/sandboxes/lib/sandbox-state.ts';

const LINE_BREAK = /\r?\n/;
const BUILDING_STATES: ReadonlySet<SnapshotState> = new Set([
	SnapshotState.Pending,
	SnapshotState.Pulling,
	SnapshotState.Building,
	SnapshotState.Capturing,
]);
const FAILED_STATES: ReadonlySet<SnapshotState> = new Set([
	SnapshotState.Error,
	SnapshotState.BuildFailed,
]);

function snapshotResourcesLabel(snapshot: SnapshotDto): string {
	const base = `${snapshot.cpu} vCPU · ${snapshot.mem} GiB · ${snapshot.disk} GiB disk`;
	if (snapshot.gpu <= 0) return base;
	const gpuLabel = snapshot.gpuType ? gpuTypeLabel(snapshot.gpuType) : 'GPU';
	return `${base} · ${snapshot.gpu} × ${gpuLabel}`;
}
</script>

<script lang="ts">
import ScrollText from '@lucide/svelte/icons/scroll-text';
import { openSnapshotBuildLogs } from '#lib/api/snapshots.ts';
import PanelSection, {
	PANEL_CODE_CLASS,
} from '#lib/components/detail/panel-section.svelte';
import LogViewer from '#lib/components/log-viewer/log-viewer.svelte';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import Timestamp from '#lib/components/ui/timestamp.svelte';
import { formatSnapshotSize } from '#lib/features/snapshots/lib/snapshots-list.ts';

interface SnapshotDetailsBodyProps {
	snapshot: SnapshotDto;
}

let { snapshot }: SnapshotDetailsBodyProps = $props();

const entrypoint = $derived(snapshot.entrypoint?.join(' ') ?? '');
const building = $derived(BUILDING_STATES.has(snapshot.state));
const failed = $derived(FAILED_STATES.has(snapshot.state));
const outputLines = $derived(
	snapshot.errorReason ? snapshot.errorReason.split(LINE_BREAK) : []
);
</script>

{#snippet openLogs()}
	{#if snapshot.buildInfo}
		<Chip
			size="compact"
			leftIcon={ScrollText}
			onclick={() => void openSnapshotBuildLogs(snapshot)}
		>
			Full logs
		</Chip>
	{/if}
{/snippet}

<div class="flex flex-col gap-3">
	{#if failed && snapshot.errorReason}
		<Notice
			tone="error"
			title={snapshot.buildInfo ? 'Build failed' : 'Snapshot failed'}
			class="mb-1"
		/>
	{/if}
	<KeyValueList framed={false} label="Snapshot details">
		<KeyValueRow label="State">
			<ResourceStateBadge
				errorReason={snapshot.errorReason}
				state={snapshot.state}
			/>
		</KeyValueRow>
		<KeyValueRow
			label="Container image"
			value={snapshot.imageName ??
				(snapshot.buildInfo ? 'Declarative build' : undefined)}
			mono={Boolean(snapshot.imageName)}
			copy={snapshot.imageName}
			copyLabel="Copy image"
		/>
		<KeyValueRow
			label="Startup command"
			value={entrypoint || 'Image default'}
			mono={Boolean(entrypoint)}
			copy={entrypoint || undefined}
			copyLabel="Copy startup command"
		/>
		<KeyValueRow label="Resources" value={snapshotResourcesLabel(snapshot)} />
		<KeyValueRow
			label="Size"
			value={snapshot.size === null
				? 'Pending'
				: formatSnapshotSize(snapshot.size)}
		/>
		<KeyValueRow
			label="Class"
			value={snapshot.sandboxClass && sandboxClassLabel(snapshot.sandboxClass)}
		/>
		{#if snapshot.general}
			<KeyValueRow label="Type">
				<Badge size="pill">System</Badge>
			</KeyValueRow>
		{/if}
		<KeyValueRow label="Created">
			<Timestamp value={snapshot.createdAt} />
		</KeyValueRow>
		<KeyValueRow label="Last used">
			{#if snapshot.lastUsedAt}
				<Timestamp value={snapshot.lastUsedAt} />
			{:else}
				<span class="text-(--text-muted)">Never</span>
			{/if}
		</KeyValueRow>
	</KeyValueList>
	{#if building || failed}
		<PanelSection title="Build output" action={openLogs}>
			<LogViewer
				lines={outputLines}
				status={building ? 'waiting' : 'ready'}
				filename={`${snapshot.name}-build.log`}
				class="h-64 flex-none"
			/>
		</PanelSection>
	{/if}
	{#if snapshot.buildInfo}
		{const buildInfo = $derived(snapshot.buildInfo)}
		<PanelSection title="Build">
			<KeyValueList framed={false} label="Build">
				<KeyValueRow label="Started">
					<Timestamp value={buildInfo.createdAt} />
				</KeyValueRow>
				<KeyValueRow label="Updated">
					<Timestamp value={buildInfo.updatedAt} />
				</KeyValueRow>
				{#each buildInfo.contextHashes ??
					[] as hash, index (`${hash}-${index}`)}
					<KeyValueRow
						label={index === 0 ? 'Context' : ''}
						value={hash}
						mono
						copy={hash}
						copyLabel="Copy context hash"
					/>
				{/each}
			</KeyValueList>
			{#if buildInfo.dockerfileContent}
				<pre
					class={[
						PANEL_CODE_CLASS,
						'max-h-75 whitespace-pre-wrap wrap-break-word',
					]}
				>{buildInfo.dockerfileContent}</pre>
			{/if}
		</PanelSection>
	{/if}
</div>
