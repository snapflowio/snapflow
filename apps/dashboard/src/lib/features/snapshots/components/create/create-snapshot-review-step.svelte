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
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import ChipModalReviewSection from '#lib/components/ui/chip-modal/chip-modal-review-section.svelte';

interface CreateSnapshotReviewStepProps {
	classLabel: string | undefined;
	values: CreateSnapshotValues;
}

let { classLabel, values }: CreateSnapshotReviewStepProps = $props();
</script>

<div class="flex flex-col gap-y-8">
	<ChipModalReviewSection title="Source">
		<KeyValueRow label="Name" value={values.name.trim()} />
		<KeyValueRow label="Container image" value={values.imageName.trim()} />
		<KeyValueRow label="Environment type" value={classLabel} />
	</ChipModalReviewSection>
	<ChipModalReviewSection title="Runtime">
		<KeyValueRow
			label="Startup command"
			value={values.entrypoint.trim() || 'Image default'}
		/>
		<KeyValueRow label="vCPUs" value={values.cpu.trim() || DEFAULT_CPU} />
		<KeyValueRow
			label="Memory"
			value={gibibytesReviewLabel(values.memory, DEFAULT_MEMORY_GIB)}
		/>
		<KeyValueRow
			label="Storage"
			value={gibibytesReviewLabel(values.disk, DEFAULT_STORAGE_GIB)}
		/>
		<KeyValueRow label="GPU" value={gpuReviewLabel(values)} />
	</ChipModalReviewSection>
</div>
