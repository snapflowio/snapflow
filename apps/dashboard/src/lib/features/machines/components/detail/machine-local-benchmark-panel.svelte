<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import type { MachineLocalBenchmark } from '@snapflow/api-client';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import ResourceDetailsPanel from '#lib/components/resource/resource-details-panel.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import { joinFacts } from '#lib/features/earnings/lib/earnings-copy.ts';
import {
	formatLatencyDistribution,
	formatThroughputDistribution,
} from '#lib/features/machines/lib/machine-health.ts';

interface MachineLocalBenchmarkPanelProps {
	benchmark: MachineLocalBenchmark | null;
	open: boolean;
	onClose: () => void;
}

let { benchmark, open, onClose }: MachineLocalBenchmarkPanelProps = $props();
</script>

<ResourceDetailsPanel
	open={open && benchmark !== null}
	title="Local benchmark"
	{onClose}
>
	{#if benchmark}
		<div class="flex flex-col gap-8 pt-2">
			<SettingsSection title="Machine">
				<KeyValueList framed={false}>
					<KeyValueRow
						label="Hardware"
						value={joinFacts([
							`${benchmark.logicalCpus} logical CPUs`,
							benchmark.architecture,
						])}
					/>
					<KeyValueRow label="Kernel" mono value={benchmark.kernel} />
					<KeyValueRow label="Release" mono value={benchmark.releaseVersion} />
				</KeyValueList>
			</SettingsSection>
			<SettingsSection title="Results" info="p50 · p95 · p99">
				<KeyValueList framed={false}>
					<KeyValueRow
						label="Storage write"
						value={formatThroughputDistribution(
							benchmark.storageWriteBytesPerSecond
						)}
					/>
					<KeyValueRow
						label="Storage read"
						value={formatThroughputDistribution(
							benchmark.storageReadBytesPerSecond
						)}
					/>
					<KeyValueRow
						label="API latency"
						value={formatLatencyDistribution(benchmark.apiHealthLatencyNanos)}
					/>
					<KeyValueRow
						label="Release check"
						value={formatLatencyDistribution(
							benchmark.releaseVerificationNanos
						)}
					/>
				</KeyValueList>
			</SettingsSection>
		</div>
	{/if}
</ResourceDetailsPanel>
