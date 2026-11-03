<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { Machine } from '@snapflow/api-client';

const DEFAULT_SANDBOX_CLASS = 'MicroVM';
const PERCENT_MAXIMUM = 100;

interface CapacityStat {
	label: string;
	allocated: number;
	total: number;
	unit: string;
	usage: number | undefined;
}

function capacityStats(machine: Machine): CapacityStat[] {
	return [
		{
			label: 'CPU',
			allocated: machine.currentAllocatedCpu ?? 0,
			total: machine.cpu,
			unit: 'vCPU',
			usage: machine.currentCpuUsagePercentage,
		},
		{
			label: 'Memory',
			allocated: machine.currentAllocatedMemoryGiB ?? 0,
			total: machine.memory,
			unit: 'GiB',
			usage: machine.currentMemoryUsagePercentage,
		},
		{
			label: 'Disk',
			allocated: machine.currentAllocatedDiskGiB ?? 0,
			total: machine.disk,
			unit: 'GiB',
			usage: machine.currentDiskUsagePercentage,
		},
	];
}
</script>

<script lang="ts">
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import PageColumn from '#lib/components/page/page-column.svelte';
import ResourceStat from '#lib/components/resource/resource-stat.svelte';
import ResourceStats from '#lib/components/resource/resource-stats.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import CopyCodeButton from '#lib/components/ui/clipboard/copy-code-button.svelte';
import Meter from '#lib/components/ui/meter.svelte';
import Notice from '#lib/components/ui/notice.svelte';
import { locationLabel } from '#lib/features/locations/lib/location-format.ts';
import MachineDetailRow from '#lib/features/machines/components/detail/machine-detail-row.svelte';
import {
	formatPercent,
	machineSchedulingLabel,
} from '#lib/features/machines/lib/machine-format.ts';
import { getMachineDetail } from '#lib/features/machines/state/machine-detail.svelte.ts';
import { formatDateTime, formatOptionalDateTime } from '#lib/utils/format.ts';

const machineDetail = getMachineDetail();
const machine = $derived(machineDetail.machine);
const stats = $derived(capacityStats(machine));
</script>

<PageColumn>
	{#if machine.draining}
		<Notice tone="warning">
			{#snippet title()}
				Decommissioning in progress
			{/snippet}
			{#snippet description()}
				No new sandboxes are placed here, and running sandboxes are moved off
				the machine.
			{/snippet}
		</Notice>
	{/if}
	<SettingsSection title="Capacity">
		<ResourceStats class="lg:grid-cols-3">
			{#each stats as capacity (capacity.label)}
				<ResourceStat
					label={capacity.label}
					value={`${capacity.allocated} / ${capacity.total} ${capacity.unit}`}
				>
					{#snippet detail()}
						<div class="mt-2 flex flex-col gap-1.5">
							<Meter
								label={`${capacity.label} usage`}
								value={capacity.usage ?? 0}
								maximum={PERCENT_MAXIMUM}
								valueText={formatPercent(capacity.usage)}
							/>
							<span>{`${formatPercent(capacity.usage)} in use`}</span>
						</div>
					{/snippet}
				</ResourceStat>
			{/each}
		</ResourceStats>
	</SettingsSection>
	<SettingsSection title="Workload">
		<ResourceStats>
			<ResourceStat
				label="Sandboxes"
				value={String(machine.currentStartedSandboxes ?? 0)}
			/>
			<ResourceStat
				label="Snapshots"
				value={String(machine.currentSnapshotCount ?? 0)}
			/>
		</ResourceStats>
	</SettingsSection>
	<SettingsSection title="Details">
		<KeyValueList>
			<KeyValueRow>
				{#snippet label()}
					Machine ID
				{/snippet}
				{#snippet value()}
					<span class="block break-all font-mono text-caption">
						{machine.id}
					</span>
				{/snippet}
				{#snippet action()}
					<CopyCodeButton code={machine.id} label="Copy machine ID" />
				{/snippet}
			</KeyValueRow>
			<MachineDetailRow
				label="Location"
				value={locationLabel(machine.location)}
			/>
			<KeyValueRow>
				{#snippet label()}
					Scheduling
				{/snippet}
				{#snippet value()}
					<Badge size="sm" variant={machine.unschedulable ? 'amber' : 'green'}>
						{machineSchedulingLabel(machine)}
					</Badge>
				{/snippet}
			</KeyValueRow>
			<MachineDetailRow
				label="Class"
				value={machine.sandboxClass ?? DEFAULT_SANDBOX_CLASS}
			/>
			<MachineDetailRow
				label="Decommissioning"
				value={machine.draining ? 'In progress' : 'Not started'}
			/>
			<MachineDetailRow
				label="Last checked"
				value={formatOptionalDateTime(machine.lastChecked, 'Never')}
			/>
			<MachineDetailRow
				label="Registered"
				value={formatDateTime(machine.createdAt)}
			/>
			<MachineDetailRow
				label="Updated"
				value={formatDateTime(machine.updatedAt)}
			/>
		</KeyValueList>
	</SettingsSection>
</PageColumn>
