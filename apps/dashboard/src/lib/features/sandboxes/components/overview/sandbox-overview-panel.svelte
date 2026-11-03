<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { Sandbox } from '@snapflow/api-client';
import { gpuTypeLabel } from '#lib/features/machines/lib/gpu-options.ts';

const IMMEDIATE_INTERVAL_MINUTES = 0;
const NEVER_LABEL = 'Never';
const ASSIGNING_LABEL = 'Assigning';

function formatInterval(minutes?: number): string {
	if (minutes === undefined || minutes < IMMEDIATE_INTERVAL_MINUTES) {
		return 'Disabled';
	}
	if (minutes === IMMEDIATE_INTERVAL_MINUTES) return 'Immediately';
	return `${minutes} minutes`;
}

function resourceLabels(sandbox: Sandbox): string[] {
	const labels = [
		`${sandbox.cpu} vCPU`,
		`${sandbox.memory} GiB RAM`,
		`${sandbox.disk} GiB disk`,
	];
	if (sandbox.gpu > 0) {
		const gpu = sandbox.gpuType ? gpuTypeLabel(sandbox.gpuType) : 'Any GPU';
		labels.push(`${sandbox.gpu} × ${gpu}`);
	}
	return labels;
}
</script>

<script lang="ts">
import FeedbackState from '#lib/components/feedback-state.svelte';
import ResourceInfoRow from '#lib/components/resource/resource-info-row.svelte';
import ResourceInfoSection from '#lib/components/resource/resource-info-section.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import Chip from '#lib/components/ui/chip/chip.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import { formatLocation } from '#lib/features/locations/lib/location-format.ts';
import type { ConfigurationMode } from '#lib/features/sandboxes/lib/sandbox-configuration.ts';
import { canResizeSandbox } from '#lib/features/sandboxes/lib/sandbox-state.ts';
import { getSandboxDetail } from '#lib/features/sandboxes/state/sandbox-detail.svelte.ts';
import { formatOptionalDateTime } from '#lib/utils/format.ts';
import SandboxConfigurationModal from './sandbox-configuration-modal.svelte';

const detail = getSandboxDetail();
const sandbox = $derived(detail.sandbox);
const labels = $derived(Object.entries(sandbox.labels));
let configurationMode = $state<ConfigurationMode | null>(null);
let openCount = $state(0);

function configure(mode: ConfigurationMode) {
	openCount += 1;
	configurationMode = mode;
}
</script>

{#snippet editAction(
	mode: ConfigurationMode,
	actionLabel: string,
	disabled: boolean
)}
	{#if detail.canWrite}
		<Chip {disabled} onclick={() => configure(mode)}>{actionLabel}</Chip>
	{/if}
{/snippet}

{#snippet resourcesAction()}
	{@render editAction(
		'resources',
		'Resize',
		detail.pending || !canResizeSandbox(sandbox)
	)}
{/snippet}

{#snippet lifecycleAction()}
	{@render editAction('lifecycle', 'Edit', detail.pending)}
{/snippet}

{#snippet labelsAction()}
	{@render editAction('labels', 'Edit', detail.pending)}
{/snippet}

<div class="flex flex-col">
	{#if sandbox.errorReason}
		{const errorReason = $derived(sandbox.errorReason)}
		<div class="px-4 pt-3">
			<Notice tone={sandbox.recoverable ? 'warning' : 'error'}>
				{#snippet title()}
					{sandbox.recoverable ? 'Sandbox can be recovered' : 'Sandbox failed'}
				{/snippet}
				{#snippet description()}
					{errorReason}
				{/snippet}
			</Notice>
		</div>
	{/if}
	<ResourceInfoSection>
		<dl class="flex flex-col">
			<ResourceInfoRow
				label="ID"
				value={sandbox.id}
				valueClass="font-mono"
				copyLabel="Copy ID"
			/>
			<ResourceInfoRow
				label="Location"
				value={formatLocation(sandbox.location) ?? ASSIGNING_LABEL}
			/>
			<ResourceInfoRow
				label="Machine"
				value={sandbox.machineId ?? ASSIGNING_LABEL}
				valueClass="font-mono"
				copyLabel={sandbox.machineId ? 'Copy machine ID' : undefined}
			/>
			<ResourceInfoRow
				label="Class"
				value={sandbox.sandboxClass ?? 'Container'}
			/>
			<ResourceInfoRow
				label="Snapshot"
				value={sandbox.snapshot ?? 'None'}
				valueClass="font-mono"
				copyLabel={sandbox.snapshot ? 'Copy snapshot' : undefined}
			/>
			<ResourceInfoRow
				label="Desired state"
				value={sandbox.desiredState ?? 'Unknown'}
			/>
		</dl>
	</ResourceInfoSection>
	<ResourceInfoSection title="Resources" action={resourcesAction}>
		<div class="flex flex-wrap gap-1.5 py-0.5">
			{#each resourceLabels(sandbox) as resource (resource)}
				<Badge variant="type">{resource}</Badge>
			{/each}
		</div>
	</ResourceInfoSection>
	<ResourceInfoSection title="Lifecycle" action={lifecycleAction}>
		<dl class="flex flex-col">
			<ResourceInfoRow
				label="Auto stop"
				value={formatInterval(sandbox.autoStopInterval)}
			/>
			<ResourceInfoRow
				label="Auto archive"
				value={formatInterval(sandbox.autoArchiveInterval)}
			/>
			<ResourceInfoRow
				label="Auto delete"
				value={formatInterval(sandbox.autoDeleteInterval)}
			/>
		</dl>
	</ResourceInfoSection>
	<ResourceInfoSection title="Labels" action={labelsAction}>
		{#if labels.length > 0}
			<div class="flex flex-wrap gap-1.5 py-0.5">
				{#each labels as [key, value] (key)}
					<Badge variant="type">{key}={value}</Badge>
				{/each}
			</div>
		{:else}
			<FeedbackState class="min-h-0 py-3" message="No labels" />
		{/if}
	</ResourceInfoSection>
	<ResourceInfoSection title="Activity">
		<dl class="flex flex-col">
			<ResourceInfoRow
				label="Created"
				value={formatOptionalDateTime(sandbox.createdAt, NEVER_LABEL)}
			/>
			<ResourceInfoRow
				label="Updated"
				value={formatOptionalDateTime(sandbox.updatedAt, NEVER_LABEL)}
			/>
			<ResourceInfoRow
				label="Last activity"
				value={formatOptionalDateTime(sandbox.lastActivityAt, NEVER_LABEL)}
			/>
		</dl>
	</ResourceInfoSection>
</div>
<SandboxConfigurationModal bind:mode={configurationMode} {openCount} />
