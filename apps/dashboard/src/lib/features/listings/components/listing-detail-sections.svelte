<!--
  ~ Copyright (c) 2026 Snapflow. All rights reserved.
  ~
  ~ Snapflow is licensed under the GNU Affero General Public License v3.0.
  ~ You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
  ~
  ~ SPDX-License-Identifier: AGPL-3.0
-->

<script lang="ts" module>
import type { MachineDetail } from '@snapflow/api-client';
import {
	formatLatency,
	LATENCY_UNIT,
	MACHINE_UNAVAILABLE_REASON_LABELS,
} from '#lib/features/listings/lib/listing-format.ts';
import { formatCount } from '#lib/utils/format.ts';

const NOT_MEASURED = 'Not measured';
const DETAIL_SEPARATOR = ' · ';

function availabilityLabel(machine: MachineDetail): string {
	if (machine.available) return 'Available';
	return machine.unavailableReason
		? MACHINE_UNAVAILABLE_REASON_LABELS[machine.unavailableReason]
		: 'Unavailable';
}

function measured(
	value: number | null,
	format: (value: number) => string
): string | null {
	return value === null ? null : format(value);
}

function joinDetail(parts: readonly (string | null)[]): string | undefined {
	return (
		parts.filter((part) => part !== null).join(DETAIL_SEPARATOR) || undefined
	);
}

function cpuDetail(machine: MachineDetail): string | undefined {
	return joinDetail([
		measured(
			machine.cpuScorePerVcpu,
			(score) => `Score ${formatCount(score)} per vCPU`
		),
		measured(
			machine.cpuSingleThreadScore,
			(score) => `${formatCount(score)} single-thread`
		),
	]);
}

function memoryDetail(machine: MachineDetail): string | undefined {
	return joinDetail([
		measured(
			machine.memoryBandwidthMibps,
			(mibps) => `${formatCount(mibps)} MiB/s bandwidth`
		),
		measured(
			machine.memoryLatencyNs,
			(latency) => `${formatLatency(latency, LATENCY_UNIT.NANOSECONDS)} latency`
		),
	]);
}

function diskDetail(machine: MachineDetail): string | undefined {
	return joinDetail([
		measured(
			machine.diskRandomReadIops,
			(iops) => `${formatCount(iops)} random read IOPS`
		),
		measured(
			machine.diskSequentialMibps,
			(mibps) => `${formatCount(mibps)} MiB/s read`
		),
		measured(
			machine.diskSequentialWriteMibps,
			(mibps) => `${formatCount(mibps)} MiB/s write`
		),
	]);
}

function diskLatency(machine: MachineDetail): string {
	return (
		measured(
			machine.diskReadLatencyMicros,
			(latency) =>
				`${formatLatency(latency, LATENCY_UNIT.MICROSECONDS)} p99 read`
		) ?? NOT_MEASURED
	);
}

function diskLatencyDetail(machine: MachineDetail): string | undefined {
	return joinDetail([
		measured(
			machine.diskFsyncLatencyMicros,
			(latency) =>
				`${formatLatency(latency, LATENCY_UNIT.MICROSECONDS)} p99 fsync`
		),
	]);
}

function networkLatency(machine: MachineDetail): string {
	return (
		measured(
			machine.networkMinRttMs,
			(rtt) => `${formatLatency(rtt, LATENCY_UNIT.MILLISECONDS)} idle RTT`
		) ?? NOT_MEASURED
	);
}

function networkLatencyDetail(machine: MachineDetail): string | undefined {
	return joinDetail([
		measured(
			machine.networkLoadedRttMs,
			(rtt) => `${formatLatency(rtt, LATENCY_UNIT.MILLISECONDS)} loaded RTT`
		),
		measured(
			machine.networkJitterMs,
			(jitter) => `${formatLatency(jitter, LATENCY_UNIT.MILLISECONDS)} jitter`
		),
	]);
}
</script>

<script lang="ts">
import FeedbackState from '#lib/components/feedback-state.svelte';
import KeyValueList from '#lib/components/page/key-value-list.svelte';
import KeyValueRow from '#lib/components/page/key-value-row.svelte';
import ResourceStateBadge from '#lib/components/resource/resource-state-badge.svelte';
import SettingsSection from '#lib/components/settings/settings-section.svelte';
import Badge from '#lib/components/ui/badge.svelte';
import {
	BINARY_UNITS_NOTE,
	formatEgressPrice,
	formatEgressPricePerTerabyte,
} from '#lib/features/billing/lib/transfer.ts';
import {
	formatCpu,
	formatGpu,
	formatResourceShape,
	MACHINE_CATEGORY_LABELS,
	MACHINE_TIER_LABELS,
	tierBadgeVariant,
} from '#lib/features/listings/lib/listing-format.ts';
import { locationLabel } from '#lib/features/locations/lib/location-format.ts';
import {
	formatBasisPointsPercent,
	formatDate,
	formatDateTime,
} from '#lib/utils/format.ts';
import { formatHourlyPrice, platformFeeLabel } from '#lib/utils/usd.ts';

interface ListingDetailSectionsProps {
	listing: MachineDetail;
}

let { listing }: ListingDetailSectionsProps = $props();

const benchmark = $derived(listing.latestBenchmark);
</script>

{#snippet textRow(
	rowLabel: string,
	rowValue: string,
	rowDetail?: string
)}
	<KeyValueRow detail={rowDetail ? detailText : undefined}>
		{#snippet label()}
			{rowLabel}
		{/snippet}
		{#snippet value()}
			{rowValue}
		{/snippet}
	</KeyValueRow>
	{#snippet detailText()}
		{rowDetail}
	{/snippet}
{/snippet}

{#snippet benchmarkCompleted()}
	{#if benchmark?.completedAt}
		{`Completed ${formatDateTime(benchmark.completedAt)}`}
	{/if}
{/snippet}

<SettingsSection
	title="Pricing"
	description={`${platformFeeLabel(listing.markupBasisPoints)}. Billed per second of use.`}
>
	<KeyValueList>
		{@render textRow('Running', formatHourlyPrice(listing.hourlyPriceMicroUsd))}
		{@render textRow(
			'Stopped',
			formatHourlyPrice(listing.stoppedHourlyPriceMicroUsd),
			'Disk kept on the machine'
		)}
		{@render textRow(
			'Platform fee',
			formatHourlyPrice(listing.markupHourlyMicroUsd),
			`Host receives ${formatHourlyPrice(listing.hostHourlyMicroUsd)}`
		)}
	</KeyValueList>
</SettingsSection>

<SettingsSection
	title="Network transfer"
	description={`Egress is billed per byte the sandbox sends, at the price locked with the lease. Ingress is free. ${BINARY_UNITS_NOTE}`}
>
	<KeyValueList>
		{@render textRow(
			'Egress',
			formatEgressPrice(listing.egressMicroUsdPerGiB),
			formatEgressPricePerTerabyte(listing.egressMicroUsdPerGiB)
		)}
		{@render textRow('Ingress', 'Free')}
		{@render textRow(
			'Platform fee',
			formatEgressPrice(listing.markupEgressMicroUsdPerGiB),
			`Host receives ${formatEgressPrice(listing.hostEgressMicroUsdPerGiB)}`
		)}
	</KeyValueList>
</SettingsSection>

<SettingsSection
	title="Specs"
	description={`Measured by the platform benchmark on ${formatDateTime(listing.measuredAt)}.`}
>
	<KeyValueList>
		{@render textRow(
			'CPU',
			formatCpu(listing.vcpu, listing.cpuModel),
			cpuDetail(listing)
		)}
		{@render textRow(
			'Memory',
			`${listing.memoryGiB} GiB`,
			memoryDetail(listing)
		)}
		{@render textRow('Disk', `${listing.diskGiB} GiB`, diskDetail(listing))}
		{@render textRow(
			'Disk latency',
			diskLatency(listing),
			diskLatencyDetail(listing)
		)}
		{@render textRow(
			'Network',
			listing.networkDownlinkMbps === null
				? NOT_MEASURED
				: `${formatCount(listing.networkDownlinkMbps)} Mbps down`,
			listing.networkUplinkMbps === null
				? undefined
				: `${formatCount(listing.networkUplinkMbps)} Mbps up`
		)}
		{@render textRow(
			'Network latency',
			networkLatency(listing),
			networkLatencyDetail(listing)
		)}
		{@render textRow(
			'GPU',
			formatGpu(listing),
			listing.gpuCount > 0
				? `${formatCount(listing.gpuTflops)} TFLOPS`
				: undefined
		)}
	</KeyValueList>
</SettingsSection>

<SettingsSection title="Reliability">
	<KeyValueList>
		<KeyValueRow>
			{#snippet label()}
				Tier
			{/snippet}
			{#snippet value()}
				<Badge size="sm" variant={tierBadgeVariant(listing.tier)}>
					{MACHINE_TIER_LABELS[listing.tier]}
				</Badge>
			{/snippet}
		</KeyValueRow>
		{@render textRow(
			'Reliability',
			formatBasisPointsPercent(listing.reliabilityBasisPoints)
		)}
		{@render textRow(
			'Uptime',
			formatBasisPointsPercent(listing.uptimeBasisPoints)
		)}
		<KeyValueRow
			detail={benchmark?.completedAt ? benchmarkCompleted : undefined}
		>
			{#snippet label()}
				Latest benchmark
			{/snippet}
			{#snippet value()}
				{#if benchmark}
					<ResourceStateBadge state={benchmark.state} />
				{:else}
					{NOT_MEASURED}
				{/if}
			{/snippet}
		</KeyValueRow>
	</KeyValueList>
</SettingsSection>

<SettingsSection title="Benchmarks">
	{#if listing.benchmarkHistory.length > 0}
		<KeyValueList>
			{#each listing.benchmarkHistory as passed (passed.completedAt)}
				{@render textRow(
					formatDate(passed.completedAt),
					formatResourceShape(passed.shape),
					`Suite version ${passed.suiteVersion}`
				)}
			{/each}
		</KeyValueList>
	{:else}
		<FeedbackState variant="inline"> No passed benchmarks yet </FeedbackState>
	{/if}
</SettingsSection>

<SettingsSection title="Location">
	<KeyValueList>
		{@render textRow('Location', locationLabel(listing.location))}
		{@render textRow('Host', listing.hostName)}
		{@render textRow('Category', MACHINE_CATEGORY_LABELS[listing.category])}
		{@render textRow('Availability', availabilityLabel(listing))}
	</KeyValueList>
</SettingsSection>
