<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { OrganizationLimits } from '@snapflow/api-client';
import type { KeysOfType } from '#lib/utils/type-utils.ts';

const LIMIT_ROWS: readonly {
	label: string;
	name: KeysOfType<OrganizationLimits, number>;
	unit?: string;
}[] = [
	{ name: 'maxCpuPerSandbox', label: 'CPU per sandbox', unit: 'vCPUs' },
	{ name: 'maxMemoryPerSandbox', label: 'Memory per sandbox', unit: 'GiB' },
	{ name: 'maxDiskPerSandbox', label: 'Disk per sandbox', unit: 'GiB' },
	{ name: 'snapshotQuota', label: 'Snapshots' },
	{ name: 'maxSnapshotSize', label: 'Snapshot size', unit: 'GiB' },
	{ name: 'volumeQuota', label: 'Volumes' },
];
</script>

<script lang="ts">
import SettingsField from '#lib/components/settings/settings-field.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';

interface OrganizationLimitsSectionProps {
	limits: OrganizationLimits;
}

let { limits }: OrganizationLimitsSectionProps = $props();
</script>

<SettingsSection title="Quotas">
	<div class="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
		{#each LIMIT_ROWS as row (row.name)}
			<SettingsField
				label={row.label}
				value={row.unit
					? `${limits[row.name]} ${row.unit}`
					: String(limits[row.name])}
			/>
		{/each}
		<SettingsField
			label="Limited network egress"
			value={limits.sandboxLimitedNetworkEgress ? 'Enforced' : 'Off'}
		/>
	</div>
	<p class="mt-4 pl-0.5 text-(--text-muted) text-small">
		Contact support to change these limits.
	</p>
</SettingsSection>
