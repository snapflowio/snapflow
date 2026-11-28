<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type {
	OrganizationUsageOverview,
	QuotaUsageOverview,
} from '@snapflow/api-client';
import { QUOTA_WARNING_RATIO } from '#lib/components/ui/meter.svelte';
import { sandboxClassLabel } from '#lib/features/sandboxes/lib/sandbox-state.ts';
import { formatBytes } from '#lib/utils/format.ts';

type CurrentKey = Extract<keyof QuotaUsageOverview, `current${string}Usage`>;
type MaximumKey = Extract<keyof QuotaUsageOverview, `total${string}Quota`>;
type PerSandboxKey =
	| 'maxCpuPerSandbox'
	| 'maxMemoryPerSandbox'
	| 'maxDiskPerSandbox';

interface UsageMetric {
	label: string;
	unit: string;
	current: CurrentKey;
	maximum: MaximumKey;
	perSandbox?: PerSandboxKey;
}

interface UsageRow {
	id: string;
	label: string;
	current: number;
	maximum: number;
	valueText: string;
	description?: string;
}

type UsageLevel = 'normal' | 'warning' | 'limit';

const LABEL_SEPARATOR = ' · ';
const STORAGE_ROW_ID = 'storage';
const STORAGE_DESCRIPTION =
	'Archived sandboxes, snapshots, templates and volume backups.';

const USAGE_METRICS: readonly UsageMetric[] = [
	{
		label: 'vCPU',
		unit: 'vCPUs',
		current: 'currentCpuUsage',
		maximum: 'totalCpuQuota',
		perSandbox: 'maxCpuPerSandbox',
	},
	{
		label: 'Memory',
		unit: 'GiB',
		current: 'currentMemoryUsage',
		maximum: 'totalMemoryQuota',
		perSandbox: 'maxMemoryPerSandbox',
	},
	{
		label: 'Disk',
		unit: 'GiB',
		current: 'currentDiskUsage',
		maximum: 'totalDiskQuota',
		perSandbox: 'maxDiskPerSandbox',
	},
	{
		label: 'GPU',
		unit: 'GPUs',
		current: 'currentGpuUsage',
		maximum: 'totalGpuQuota',
	},
];

function quotaRows(quota: QuotaUsageOverview): UsageRow[] {
	const classLabel = sandboxClassLabel(quota.sandboxClass);
	return USAGE_METRICS.flatMap((metric) => {
		const current = quota[metric.current];
		const maximum = quota[metric.maximum];
		if (maximum <= 0 && current <= 0) return [];
		const perSandbox = metric.perSandbox ? quota[metric.perSandbox] : null;
		return [
			{
				id: `${quota.sandboxClass}-${metric.current}`,
				label: [classLabel, metric.label].join(LABEL_SEPARATOR),
				current,
				maximum,
				valueText: `${current} / ${maximum} ${metric.unit}`,
				description:
					perSandbox === null
						? undefined
						: `Up to ${perSandbox} ${metric.unit} per sandbox.`,
			},
		];
	});
}

function usageRows(usage: OrganizationUsageOverview): UsageRow[] {
	const stored = Number(usage.storedBytes);
	const cap = Number(usage.storageCapBytes);
	return [
		...usage.quotaUsage.flatMap(quotaRows),
		{
			id: STORAGE_ROW_ID,
			label: 'Snapflow storage',
			current: stored,
			maximum: cap,
			valueText: `${formatBytes(stored)} / ${formatBytes(cap)}`,
			description: STORAGE_DESCRIPTION,
		},
	];
}

function usageLevel(row: UsageRow): UsageLevel {
	if (row.maximum <= 0) return row.current > 0 ? 'limit' : 'normal';
	const ratio = row.current / row.maximum;
	if (ratio >= 1) return 'limit';
	return ratio >= QUOTA_WARNING_RATIO ? 'warning' : 'normal';
}
</script>

<script lang="ts">
import SettingsRow from '#lib/components/settings/settings-row.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import Meter from '#lib/components/ui/meter.svelte';
import { cn } from '#lib/utils/utils.ts';

interface OrganizationUsageRowsProps {
	usage: OrganizationUsageOverview;
}

let { usage }: OrganizationUsageRowsProps = $props();

const rows = $derived(usageRows(usage));
</script>

<SettingsSection
	title="Usage"
	info="Running and stopped sandboxes count against the limits of your tier or your custom limits, whichever is higher."
>
	{#each rows as row (row.id)}
		{const level = $derived(usageLevel(row))}
		<SettingsRow label={row.label} description={row.description}>
			<div class="flex items-center gap-4">
				{#if level === 'limit'}
					<Badge size="sm" variant="error">At limit</Badge>
				{/if}
				<span
					class={cn(
						'text-sm tabular-nums',
						level === 'warning' ? 'text-(--warning)' : 'text-(--text-primary)'
					)}
				>
					{row.valueText}
				</span>
				<Meter
					label={`${row.label} in use`}
					value={row.current}
					maximum={row.maximum}
					valueText={row.valueText}
					tone={level === 'limit' ? 'error' : 'auto'}
					class="w-24 max-md:hidden"
				/>
			</div>
		</SettingsRow>
	{/each}
</SettingsSection>
