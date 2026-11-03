<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import {
	gpuTypeLabel,
	isGpuType,
} from '#lib/features/machines/lib/gpu-options.ts';
import {
	type CreateSnapshotValues,
	DEFAULT_CPU,
	DEFAULT_MEMORY_GIB,
	DEFAULT_STORAGE_GIB,
} from '#lib/features/snapshots/lib/create-snapshot-form.ts';

function gpuReviewLabel(values: CreateSnapshotValues): string {
	if (!values.gpu) return 'None';
	return isGpuType(values.gpuType) ? gpuTypeLabel(values.gpuType) : 'Enabled';
}

function gibibytesReviewLabel(value: string, defaultGibibytes: number): string {
	const trimmed = value.trim();
	return `${trimmed || defaultGibibytes} GiB`;
}
</script>

<script lang="ts">
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';

interface CreateSnapshotReviewStepProps {
	classLabel: string | undefined;
	values: CreateSnapshotValues;
}

let { classLabel, values }: CreateSnapshotReviewStepProps = $props();

const rows = $derived([
	{ label: 'Name', value: values.name.trim() || '—' },
	{ label: 'Container image', value: values.imageName.trim() || '—' },
	{ label: 'Environment type', value: classLabel ?? '—' },
	{
		label: 'Startup command',
		value: values.entrypoint.trim() || 'Image default',
	},
	{ label: 'vCPUs', value: values.cpu.trim() || String(DEFAULT_CPU) },
	{
		label: 'Memory',
		value: gibibytesReviewLabel(values.memory, DEFAULT_MEMORY_GIB),
	},
	{
		label: 'Storage',
		value: gibibytesReviewLabel(values.disk, DEFAULT_STORAGE_GIB),
	},
	{ label: 'GPU', value: gpuReviewLabel(values) },
]);
</script>

<div class="px-2">
	<KeyValueList>
		{#each rows as row (row.label)}
			<KeyValueRow>
				{#snippet label()}
					{row.label}
				{/snippet}
				{#snippet value()}
					{row.value}
				{/snippet}
			</KeyValueRow>
		{/each}
	</KeyValueList>
</div>
