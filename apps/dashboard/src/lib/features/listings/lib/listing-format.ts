/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import {
	type CreatePriceCard,
	EgressCeilingSource,
	type GpuType,
	ListingState,
	ListingVisibility,
	MachineCategory,
	MachineTier,
	MachineUnavailableReason,
	PriceFloorSource,
	type ResourceShape,
} from '@snapflow/api-client';
import type { BadgeProps } from '#lib/components/ui/badge.svelte';
import { gpuTypeLabel } from '#lib/features/machines/lib/gpu-options.ts';
import { DISPLAY_LOCALE } from '#lib/utils/format.ts';

const HOURS_PER_BILLING_MONTH = 730n;
const NO_GPU_LABEL = 'None';
const COMPACT_COUNT_FORMAT = new Intl.NumberFormat(DISPLAY_LOCALE, {
	notation: 'compact',
});
const LATENCY_FRACTION_DIGITS = 1;
const LATENCY_FORMAT = new Intl.NumberFormat(DISPLAY_LOCALE, {
	maximumFractionDigits: LATENCY_FRACTION_DIGITS,
});

export const LATENCY_UNIT = {
	NANOSECONDS: 'ns',
	MICROSECONDS: 'µs',
	MILLISECONDS: 'ms',
} as const;

type LatencyUnit = (typeof LATENCY_UNIT)[keyof typeof LATENCY_UNIT];

export const MACHINE_TIER_ORDER = [
	MachineTier.Private,
	MachineTier.Community,
	MachineTier.Verified,
	MachineTier.Datacenter,
] as const satisfies readonly MachineTier[];

export const MACHINE_TIER_LABELS: Record<MachineTier, string> = {
	[MachineTier.Private]: 'Private',
	[MachineTier.Community]: 'Community',
	[MachineTier.Verified]: 'Verified',
	[MachineTier.Datacenter]: 'Datacenter',
};

const MACHINE_TIER_BADGES: Record<MachineTier, BadgeProps['variant']> = {
	[MachineTier.Private]: 'gray-secondary',
	[MachineTier.Community]: 'blue',
	[MachineTier.Verified]: 'green',
	[MachineTier.Datacenter]: 'purple',
};

export const MACHINE_CATEGORY_ORDER = [
	MachineCategory.Gpu,
	MachineCategory.General,
	MachineCategory.HighMemory,
] as const satisfies readonly MachineCategory[];

export const MACHINE_CATEGORY_LABELS: Record<MachineCategory, string> = {
	[MachineCategory.General]: 'General',
	[MachineCategory.HighMemory]: 'High memory',
	[MachineCategory.Gpu]: 'GPU',
};

export const MACHINE_UNAVAILABLE_REASON_LABELS: Record<
	MachineUnavailableReason,
	string
> = {
	[MachineUnavailableReason.Full]: 'Full',
	[MachineUnavailableReason.Offline]: 'Offline',
	[MachineUnavailableReason.Paused]: 'Paused',
	[MachineUnavailableReason.ExposureLimited]: 'At its exposure limit',
};

export const LISTING_STATE_LABELS: Record<ListingState, string> = {
	[ListingState.Draft]: 'Draft',
	[ListingState.Listed]: 'Listed',
	[ListingState.Paused]: 'Paused',
};

export const LISTING_VISIBILITY_LABELS: Record<ListingVisibility, string> = {
	[ListingVisibility.Private]: 'Private',
	[ListingVisibility.Public]: 'Public',
};

export const PRICE_FLOOR_SOURCE_LABELS: Record<PriceFloorSource, string> = {
	[PriceFloorSource.Market]: 'Market',
	[PriceFloorSource.Bootstrap]: 'Bootstrap',
};

export const EGRESS_CEILING_SOURCE_LABELS: Record<EgressCeilingSource, string> =
	{
		[EgressCeilingSource.Market]: 'Set by the Verified market median',
		[EgressCeilingSource.Settings]: 'Platform maximum',
	};

export function tierBadgeVariant(tier: MachineTier): BadgeProps['variant'] {
	return MACHINE_TIER_BADGES[tier];
}

interface GpuSpec {
	gpuCount: number;
	gpuMemoryGiB: number;
	gpuType: GpuType | null;
}

export function formatGpu({
	gpuCount,
	gpuMemoryGiB,
	gpuType,
}: GpuSpec): string {
	if (gpuCount === 0 || !gpuType) return NO_GPU_LABEL;
	return `${gpuCount} × ${gpuTypeLabel(gpuType)} · ${gpuMemoryGiB} GiB`;
}

export function formatCpu(
	vcpu: number | null,
	cpuModel: string | null
): string {
	const cores = vcpu === null ? null : `${vcpu} vCPU`;
	return [cores, cpuModel].filter(Boolean).join(' · ');
}

interface ListingSpec extends GpuSpec {
	vcpu: number | null;
	memoryGiB: number | null;
}

export function formatListingSpecs({
	vcpu,
	memoryGiB,
	gpuCount,
	gpuType,
}: ListingSpec): string {
	return [
		vcpu === null ? null : `${vcpu} vCPU`,
		memoryGiB === null ? null : `${memoryGiB} GiB`,
		gpuCount > 0 && gpuType ? `${gpuCount} × ${gpuTypeLabel(gpuType)}` : null,
	]
		.filter(Boolean)
		.join(' · ');
}

export function formatResourceShape(shape: ResourceShape): string {
	return [
		`${shape.cpu} vCPU`,
		`${shape.memoryGiB} GiB RAM`,
		`${shape.diskGiB} GiB disk`,
		shape.gpu > 0 ? `${shape.gpu} GPU` : null,
	]
		.filter(Boolean)
		.join(' · ');
}

export function formatIops(randomReadIops: number | null): string | undefined {
	return randomReadIops === null
		? undefined
		: `${COMPACT_COUNT_FORMAT.format(randomReadIops)} IOPS`;
}

export function formatLatency(value: number, unit: LatencyUnit): string {
	return `${LATENCY_FORMAT.format(value)} ${unit}`;
}

export function referencePriceMicroUsd(
	rates: CreatePriceCard,
	shape: ResourceShape
): string {
	const hourly =
		BigInt(shape.cpu) * BigInt(rates.vcpuHourMicroUsd) +
		BigInt(shape.memoryGiB) * BigInt(rates.memoryGibHourMicroUsd) +
		BigInt(shape.gpu) * BigInt(rates.gpuHourMicroUsd);
	const numerator =
		hourly * HOURS_PER_BILLING_MONTH +
		BigInt(shape.diskGiB) * BigInt(rates.diskGibMonthMicroUsd);
	return (numerator / HOURS_PER_BILLING_MONTH).toString();
}
