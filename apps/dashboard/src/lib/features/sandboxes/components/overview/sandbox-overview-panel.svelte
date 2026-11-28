<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import { formatMinutes } from '#lib/utils/format.ts';

const IMMEDIATE_INTERVAL_MINUTES = 0;
const ASSIGNING_LABEL = 'Assigning';
const DISABLED_LABEL = 'Never';
const NO_GPU_LABEL = 'None';
const ANY_GPU_LABEL = 'Any';

function formatInterval(minutes?: number): string {
	if (minutes === undefined || minutes < IMMEDIATE_INTERVAL_MINUTES) {
		return DISABLED_LABEL;
	}
	if (minutes === IMMEDIATE_INTERVAL_MINUTES) return 'Immediately';
	return formatMinutes(minutes);
}

function formatStopInterval(minutes?: number): string {
	return minutes === IMMEDIATE_INTERVAL_MINUTES
		? DISABLED_LABEL
		: formatInterval(minutes);
}

function formatArchiveInterval(minutes?: number): string {
	return minutes === IMMEDIATE_INTERVAL_MINUTES
		? 'Organization setting'
		: formatInterval(minutes);
}
</script>

<script lang="ts">
import ContextCard from '#lib/components/detail/context-card.svelte';
import StatisticCard from '#lib/components/detail/statistic-card.svelte';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import { middleTruncate } from '#lib/components/ui/overflow/middle-truncate.ts';
import Timestamp from '#lib/components/ui/timestamp.svelte';
import { formatLocation } from '#lib/features/locations/lib/location-format.ts';
import { gpuTypeLabel } from '#lib/features/machines/lib/gpu-options.ts';
import { sandboxAttention } from '#lib/features/sandboxes/lib/sandbox-attention.ts';
import type { ConfigurationMode } from '#lib/features/sandboxes/lib/sandbox-configuration.ts';
import {
	formatExpectedStart,
	resizeBlockedReason,
	SANDBOX_ACTION_PENDING_REASON,
	sandboxClassLabel,
	sandboxDesiredStateLabel,
} from '#lib/features/sandboxes/lib/sandbox-state.ts';
import type { SandboxDetail } from '#lib/features/sandboxes/state/sandbox-detail.svelte.ts';
import type { SandboxDetailActions } from '#lib/features/sandboxes/state/sandbox-detail-actions.svelte.ts';
import SandboxAttentionNotice from '../sandbox-attention-notice.svelte';
import SandboxCostSection from './sandbox-cost-section.svelte';

interface SandboxOverviewPanelProps {
	detail: SandboxDetail;
	actions: SandboxDetailActions;
}

let { detail, actions }: SandboxOverviewPanelProps = $props();

const sandbox = $derived(detail.sandbox);
const price = $derived(detail.priceQuery.data);
const labels = $derived(Object.entries(sandbox.labels));
const gpuLabel = $derived(
	sandbox.gpu > 0
		? `${sandbox.gpu} × ${sandbox.gpuType ? gpuTypeLabel(sandbox.gpuType) : ANY_GPU_LABEL}`
		: NO_GPU_LABEL
);
const attention = $derived(sandboxAttention(sandbox, price));
const desiredStateDiffers = $derived(
	sandbox.desiredState !== undefined &&
		String(sandbox.desiredState) !== String(sandbox.state)
);
</script>

{#snippet editAction(
	mode: ConfigurationMode,
	actionLabel: string,
	blockedReason: string | null
)}
	{#if detail.canWrite}
		{const reason = $derived(
			detail.pending ? SANDBOX_ACTION_PENDING_REASON : blockedReason
		)}
		<Chip
			size="compact"
			variant="ghost"
			disabledReason={reason ?? undefined}
			disabled={reason !== null}
			onclick={() => actions.configure(mode)}
		>
			{actionLabel}
		</Chip>
	{/if}
{/snippet}

{#snippet resourcesAction()}
	{@render editAction('resources', 'Resize', resizeBlockedReason(sandbox))}
{/snippet}

{#snippet lifecycleAction()}
	{@render editAction('lifecycle', 'Edit', null)}
{/snippet}

{#snippet labelsAction()}
	{@render editAction('labels', 'Edit', null)}
{/snippet}

<div class="flex flex-col gap-2">
	{#if attention}
		<SandboxAttentionNotice {attention} />
	{/if}
	<ContextCard title="Details">
		<KeyValueList framed={false} label="Details">
			<KeyValueRow label="ID" mono copy={sandbox.id} copyLabel="Copy ID">
				<span
					class="block overflow-hidden whitespace-nowrap"
					{@attach middleTruncate({ text: sandbox.id })}
				></span>
			</KeyValueRow>
			<KeyValueRow
				label="Location"
				value={formatLocation(sandbox.location) ?? ASSIGNING_LABEL}
			/>
			<KeyValueRow
				label="Machine"
				mono={Boolean(sandbox.machineId)}
				copy={sandbox.machineId}
				copyLabel="Copy machine ID"
			>
				{#if sandbox.machineId}
					{@const machineId = sandbox.machineId}
					<span
						class="block overflow-hidden whitespace-nowrap"
						{@attach middleTruncate({ text: machineId })}
					></span>
				{:else}
					{ASSIGNING_LABEL}
				{/if}
			</KeyValueRow>
			<KeyValueRow
				label="Class"
				value={sandboxClassLabel(sandbox.sandboxClass)}
			/>
			<KeyValueRow
				label="Snapshot"
				value={sandbox.snapshot}
				copy={sandbox.snapshot}
				copyLabel="Copy snapshot"
			/>
			{#if desiredStateDiffers}
				<KeyValueRow
					label="Desired state"
					value={sandboxDesiredStateLabel(sandbox.desiredState)}
				/>
			{/if}
		</KeyValueList>
	</ContextCard>
	<ContextCard title="Resources" action={resourcesAction}>
		<div class="grid grid-cols-2 gap-x-6 gap-y-4">
			<StatisticCard label="vCPU" value={String(sandbox.cpu)} />
			<StatisticCard label="Memory" value={`${sandbox.memory} GiB`} />
			<StatisticCard label="Disk" value={`${sandbox.disk} GiB`} />
			<StatisticCard label="GPU" value={gpuLabel} />
		</div>
	</ContextCard>
	<SandboxCostSection {detail} {price} />
	<ContextCard title="Lifecycle" action={lifecycleAction}>
		<KeyValueList framed={false} label="Lifecycle">
			{#if sandbox.expectedStartSeconds != null}
				<KeyValueRow
					label="Expected start"
					value={formatExpectedStart(sandbox.expectedStartSeconds)}
				/>
			{/if}
			<KeyValueRow
				label="Auto stop"
				value={formatStopInterval(sandbox.autoStopInterval)}
			/>
			<KeyValueRow
				label="Auto archive"
				value={formatArchiveInterval(sandbox.autoArchiveInterval)}
			/>
			<KeyValueRow
				label="Auto delete"
				value={formatInterval(sandbox.autoDeleteInterval)}
			/>
		</KeyValueList>
	</ContextCard>
	<ContextCard title="Labels" action={labelsAction}>
		{#if labels.length > 0}
			<div class="flex min-w-0 flex-wrap gap-1.5">
				{#each labels as [key, value] (key)}
					{const label = $derived(`${key}=${value}`)}
					<Badge size="pill" class="max-w-full shrink" title={label}>
						<span class="min-w-0 truncate">{label}</span>
					</Badge>
				{/each}
			</div>
		{:else}
			<p class="text-(--text-muted) text-sm">None</p>
		{/if}
	</ContextCard>
	<ContextCard title="Activity">
		<KeyValueList framed={false} label="Activity">
			<KeyValueRow label="Created">
				{#if sandbox.createdAt}
					<Timestamp value={sandbox.createdAt} />
				{:else}
					<span class="text-(--text-muted)">—</span>
				{/if}
			</KeyValueRow>
			<KeyValueRow label="Last activity">
				{#if sandbox.lastActivityAt}
					<Timestamp value={sandbox.lastActivityAt} />
				{:else}
					<span class="text-(--text-muted)">Never</span>
				{/if}
			</KeyValueRow>
		</KeyValueList>
	</ContextCard>
</div>
