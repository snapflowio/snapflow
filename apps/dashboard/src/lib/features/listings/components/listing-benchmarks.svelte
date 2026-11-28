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
	formatLatency,
	LATENCY_UNIT,
} from '#lib/features/listings/lib/listing-format.ts';
import { formatCount } from '#lib/utils/format.ts';

interface BenchmarkMetric {
	title: string;
	value: string;
	context?: string;
}

const NOT_MEASURED = '—';
const P99_CONTEXT = 'p99';

function measured(
	value: number | null,
	format: (value: number) => string
): string {
	return value === null ? NOT_MEASURED : format(value);
}

function metric(
	title: string,
	value: number | null,
	format: (value: number) => string,
	context?: string
): BenchmarkMetric {
	return { title, value: measured(value, format), context };
}

const formatTflops = (tflops: number) => `${formatCount(tflops)} TFLOPS`;
const formatMibps = (mibps: number) => `${formatCount(mibps)} MiB/s`;
const formatMbps = (mbps: number) => `${formatCount(mbps)} Mbps`;
const formatIops = (iops: number) => `${formatCount(iops)} IOPS`;
const formatMicros = (micros: number) =>
	formatLatency(micros, LATENCY_UNIT.MICROSECONDS);
const formatMillis = (millis: number) =>
	formatLatency(millis, LATENCY_UNIT.MILLISECONDS);
const formatNanos = (nanos: number) =>
	formatLatency(nanos, LATENCY_UNIT.NANOSECONDS);
</script>

<script lang="ts">
import Gauge from '@lucide/svelte/icons/gauge';
import DetailSection from '#lib/components/detail/detail-section.svelte';
import MetricCell from '#lib/components/detail/metric-cell.svelte';
import MetricGroup, {
	metricColumns,
} from '#lib/components/detail/metric-group.svelte';
import EmptyState from '#lib/components/empty-state.svelte';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import PageColumn from '#lib/components/page/page-column.svelte';
import Timestamp from '#lib/components/ui/timestamp.svelte';
import { formatResourceShape } from '#lib/features/listings/lib/listing-format.ts';
import { getListingDetail } from '#lib/features/listings/state/listing-detail.svelte.ts';

const detail = getListingDetail();
const listing = $derived(detail.loaded);
const groups = $derived(
	[
		{
			title: 'CPU',
			items: [
				metric('Score per vCPU', listing.cpuScorePerVcpu, formatCount),
				metric('Single thread', listing.cpuSingleThreadScore, formatCount),
			],
		},
		{
			title: 'Memory',
			items: [
				metric('Bandwidth', listing.memoryBandwidthMibps, formatMibps),
				metric('Latency', listing.memoryLatencyNs, formatNanos),
			],
		},
		{
			title: 'Disk',
			items: [
				metric('Random read', listing.diskRandomReadIops, formatIops),
				metric('Sequential read', listing.diskSequentialMibps, formatMibps),
				metric(
					'Sequential write',
					listing.diskSequentialWriteMibps,
					formatMibps
				),
				metric(
					'Read latency',
					listing.diskReadLatencyMicros,
					formatMicros,
					P99_CONTEXT
				),
				metric(
					'Fsync latency',
					listing.diskFsyncLatencyMicros,
					formatMicros,
					P99_CONTEXT
				),
			],
		},
		{
			title: 'Network',
			items: [
				metric('Download', listing.networkDownlinkMbps, formatMbps),
				metric('Upload', listing.networkUplinkMbps, formatMbps),
				metric('Idle RTT', listing.networkMinRttMs, formatMillis),
				metric('Loaded RTT', listing.networkLoadedRttMs, formatMillis),
				metric('Jitter', listing.networkJitterMs, formatMillis),
			],
		},
		{
			title: 'GPU',
			visible: listing.gpuCount > 0,
			items: [metric('Compute', listing.gpuTflops, formatTflops)],
		},
	].filter((group) => group.visible !== false)
);
</script>

<PageColumn class="gap-y-12">
	{#each groups as group, index (group.title)}
		<DetailSection title={group.title} separated={index > 0}>
			<MetricGroup
				label={group.title}
				columns={metricColumns(group.items.length)}
			>
				{#each group.items as item (item.title)}
					<MetricCell
						size="md"
						title={item.title}
						value={item.value}
						context={item.context}
					/>
				{/each}
			</MetricGroup>
		</DetailSection>
	{/each}
	<DetailSection title="History">
		{#if listing.benchmarkHistory.length > 0}
			<KeyValueList label="Benchmark history">
				{#each listing.benchmarkHistory as passed (passed.completedAt)}
					<KeyValueRow
						label={formatResourceShape(passed.shape)}
						info={`Suite version ${passed.suiteVersion}`}
						align="end"
					>
						<Timestamp value={passed.completedAt} />
					</KeyValueRow>
				{/each}
			</KeyValueList>
		{:else}
			<EmptyState icon={Gauge} title="No passed benchmarks yet" />
		{/if}
	</DetailSection>
</PageColumn>
