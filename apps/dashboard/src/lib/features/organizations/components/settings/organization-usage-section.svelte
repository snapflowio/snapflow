<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { OrganizationUsageOverview } from '@snapflow/api-client';
import SettingsResourceRow from '#lib/components/settings/settings-resource-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import Meter from '#lib/components/ui/meter.svelte';

interface OrganizationUsageSectionProps {
	usage: OrganizationUsageOverview;
}

let { usage }: OrganizationUsageSectionProps = $props();
</script>

{#snippet quota(
	label: string,
	used: number,
	total: number
)}
	<SettingsSection title={label}>
		<div class="flex flex-col gap-2.5">
			<div class="flex items-center justify-between gap-2">
				<span class="text-(--text-body) text-small tabular-nums">
					{used}
					used / {total} total
				</span>
				{#if used > total}
					<Badge variant="amber" size="sm">Over limit</Badge>
				{/if}
			</div>
			<Meter
				{label}
				value={used}
				maximum={total}
				valueText={`${used} of ${total}`}
			/>
		</div>
	</SettingsSection>
{/snippet}

{@render quota(
	'Snapshots',
	usage.currentSnapshotUsage,
	usage.totalSnapshotQuota
)}
{@render quota('Volumes', usage.currentVolumeUsage, usage.totalVolumeQuota)}

{#if usage.quotaUsage.length > 0}
	<SettingsSection title="Sandbox quotas">
		<div class="flex flex-col gap-y-0.5">
			{#each usage.quotaUsage as quota (quota.sandboxClass)}
				<SettingsResourceRow
					title={quota.sandboxClass}
					description={`${quota.currentCpuUsage} of ${quota.totalCpuQuota} vCPUs · ${quota.currentMemoryUsage} of ${quota.totalMemoryQuota} GiB memory · ${quota.currentDiskUsage} of ${quota.totalDiskQuota} GiB disk · ${quota.currentGpuUsage} of ${quota.totalGpuQuota} GPUs`}
				/>
			{/each}
		</div>
	</SettingsSection>
{/if}
