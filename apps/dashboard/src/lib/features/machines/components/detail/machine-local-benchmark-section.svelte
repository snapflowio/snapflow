<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts">
import Gauge from '@lucide/svelte/icons/gauge';
import type { MachineLocalBenchmark } from '@snapflow/api-client';
import DetailSection from '#lib/components/detail/detail-section.svelte';
import MetricCell from '#lib/components/detail/metric-cell.svelte';
import MetricGroup from '#lib/components/detail/metric-group.svelte';
import StatusBlock from '#lib/components/detail/status-block.svelte';
import { formatRelativeTime } from '#lib/components/resource/table/time-cell.ts';
import Chip from '#lib/components/ui/chip/chip.svelte';
import { localBenchmarkMetrics } from '#lib/features/machines/lib/machine-health.ts';

const RUN_HINT = 'Run snapflow doctor --benchmark on the machine.';

interface MachineLocalBenchmarkSectionProps {
	benchmark: MachineLocalBenchmark | null;
	onOpen: () => void;
}

let { benchmark, onOpen }: MachineLocalBenchmarkSectionProps = $props();

const metrics = $derived(benchmark ? localBenchmarkMetrics(benchmark) : []);
</script>

{#snippet resultsAction()}
	{#if benchmark}
		<span class="text-(--text-subtle) text-sm">
			{formatRelativeTime(benchmark.recordedAt)}
		</span>
		<Chip variant="secondary" size="compact" onclick={onOpen}>Details</Chip>
	{/if}
{/snippet}

<DetailSection title="Local benchmark" info={RUN_HINT} action={resultsAction}>
	{#if benchmark}
		<MetricGroup label="Local benchmark results">
			{#each metrics as metric (metric.label)}
				<MetricCell
					title={metric.label}
					context="p50"
					value={metric.median}
					caption={metric.tail}
				/>
			{/each}
		</MetricGroup>
	{:else}
		<StatusBlock
			icon={Gauge}
			title="No local benchmark yet"
			description={RUN_HINT}
		/>
	{/if}
</DetailSection>
