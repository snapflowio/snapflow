/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { containsPattern } from '../../common/utils/pagination/like-pattern.util';
import type { ResourceShapeFields } from '../../common/values/resource-shape.value';
import type { Continent } from '../../location/enums/continent.enum';
import type { LocationConstraint } from '../../location/types/geo-location.types';
import {
	constrainedContinents,
	constrainedCountries,
	countryCodesNamed,
} from '../../location/utils/location-constraint.util';
import type { GpuType } from '../../machine/enums/gpu-type.enum';
import { MachineRuntimeFeature } from '../../machine/enums/machine-runtime-feature.enum';
import { MachineState } from '../../machine/enums/machine-state.enum';
import { ListingState } from '../enums/listing-state.enum';
import { ListingVisibility } from '../enums/listing-visibility.enum';
import type { MachineCategory } from '../enums/machine-category.enum';
import { MachineTier } from '../enums/machine-tier.enum';
import {
	countedCompute,
	hostGateSql,
	workloadGateSql,
} from './machine-eligibility.query';
import {
	OFFER_CARD_COLUMNS_SQL,
	type OfferCardRow,
} from './offer-card-columns.query';

export interface MachineBrowseRow extends OfferCardRow {
	machine_id: string;
	name: string;
	country: string | null;
	continent: Continent | null;
	city: string | null;
	latitude: number | null;
	longitude: number | null;
	host_name: string;
	organization_id: string;
	tier: MachineTier;
	category: MachineCategory;
	cpu_model: string | null;
	vcpu: number;
	memory_gib: number;
	disk_gib: number;
	gpu_type: GpuType | null;
	gpu_count: number;
	gpu_memory_gib: number;
	gpu_tflops: number;
	cpu_single_thread_score: number | null;
	cpu_score_per_vcpu: number | null;
	memory_bandwidth_mibps: number | null;
	memory_latency_ns: number | null;
	disk_random_read_iops: number | null;
	disk_sequential_mibps: number | null;
	disk_sequential_write_mibps: number | null;
	disk_read_latency_micros: number | null;
	disk_fsync_latency_micros: number | null;
	network_downlink_mbps: number | null;
	network_uplink_mbps: number | null;
	network_min_rtt_ms: number | null;
	network_loaded_rtt_ms: number | null;
	network_jitter_ms: number | null;
	measured_at: Date | string;
	listed_since: Date | string | null;
	created_at: Date | string;
	reliability_basis_points: number;
	uptime_basis_points: number;
	listing_state: ListingState;
	online: boolean;
	fits: boolean;
}

export interface MachineBrowseFilter {
	customerOrganizationId: string;
	shape: ResourceShapeFields;
	category?: MachineCategory;
	gpuTypes?: readonly GpuType[];
	locations?: readonly LocationConstraint[];
	tiers?: readonly MachineTier[];
	minimumReliabilityBasisPoints?: number;
	persistentVolumes?: boolean;
	minimumGpuMemoryGiB?: number;
	search?: string;
	machineId?: string;
	limit: number;
}

export interface MachineBrowseQuery {
	sql: string;
	bindings: unknown[];
}

export interface Condition {
	sql: string;
	bindings: unknown[];
}

const RELIABILITY_SQL = 'COALESCE(assessment."reliabilityBasisPoints", 0)';

const READABLE_GPU_TYPE_SQL = `replace(machine."gpuType", '_', ' ')`;

const READABLE_CONTINENT_SQL = `replace(machine.continent::text, '_', ' ')`;

export function publicListingCondition(): Condition {
	return {
		sql: `(listing.visibility = ? AND machine.tier <> ? AND machine."restrictedAt" IS NULL AND card.id IS NOT NULL)`,
		bindings: [ListingVisibility.PUBLIC, MachineTier.PRIVATE],
	};
}

export function visibleListingCondition(
	customerOrganizationId: string
): Condition {
	const publicListing = publicListingCondition();
	return {
		sql: `(${publicListing.sql} OR machine."organizationId" = ?)`,
		bindings: [...publicListing.bindings, customerOrganizationId],
	};
}

export const HOST_DISPLAY_NAME_SQL =
	'COALESCE(host_profile."displayName", organization.name)';

function locationCondition(
	constraints: readonly LocationConstraint[]
): Condition {
	const countries = constrainedCountries(constraints);
	const continents = constrainedContinents(constraints);
	return {
		sql: '(machine.country = ANY(ARRAY[?]::varchar[]) OR machine.continent::text = ANY(ARRAY[?]::varchar[]))',
		bindings: [countries, continents],
	};
}

function searchCondition(search: string): Condition {
	const pattern = containsPattern(search);
	return {
		sql: `(machine.name ILIKE ? OR ${HOST_DISPLAY_NAME_SQL} ILIKE ?
			OR machine."cpuModel" ILIKE ? OR ${READABLE_GPU_TYPE_SQL} ILIKE ?
			OR machine.city ILIKE ? OR ${READABLE_CONTINENT_SQL} ILIKE ?
			OR machine.country = ANY(ARRAY[?]::varchar[]))`,
		bindings: [
			pattern,
			pattern,
			pattern,
			pattern,
			pattern,
			pattern,
			countryCodesNamed(search),
		],
	};
}

function optionalConditions(filter: MachineBrowseFilter): Condition[] {
	const conditions: Condition[] = [];
	if (filter.search !== undefined) {
		conditions.push(searchCondition(filter.search));
	}
	if (filter.minimumGpuMemoryGiB !== undefined) {
		conditions.push({
			sql: 'machine."gpuMemoryGib" >= ?',
			bindings: [filter.minimumGpuMemoryGiB],
		});
	}
	if (filter.category !== undefined) {
		conditions.push({
			sql: 'machine.category = ?',
			bindings: [filter.category],
		});
	}
	if (filter.gpuTypes !== undefined && filter.gpuTypes.length > 0) {
		conditions.push({
			sql: 'machine."gpuType" = ANY(ARRAY[?]::varchar[])',
			bindings: [filter.gpuTypes],
		});
	}
	if (filter.locations !== undefined && filter.locations.length > 0) {
		conditions.push(locationCondition(filter.locations));
	}
	if (filter.tiers !== undefined) {
		conditions.push({
			sql: 'machine.tier = ANY(ARRAY[?]::varchar[])',
			bindings: [filter.tiers],
		});
	}
	if (filter.minimumReliabilityBasisPoints !== undefined) {
		conditions.push({
			sql: `${RELIABILITY_SQL} >= ?`,
			bindings: [filter.minimumReliabilityBasisPoints],
		});
	}
	if (filter.persistentVolumes === true) {
		conditions.push({
			sql: `jsonb_exists(machine."runtimeCapabilities"->'features', ?)`,
			bindings: [MachineRuntimeFeature.VOLUME],
		});
	}
	if (filter.machineId !== undefined) {
		conditions.push({
			sql: 'machine.id = ?',
			bindings: [filter.machineId],
		});
	}
	return conditions;
}

export function machineBrowseQuery(
	filter: MachineBrowseFilter
): MachineBrowseQuery {
	const host = hostGateSql();
	const workload = workloadGateSql(filter.shape, countedCompute(false));
	const conditions: Condition[] = [
		{
			sql: 'listing.state = ANY(ARRAY[?]::varchar[])',
			bindings: [[ListingState.LISTED, ListingState.PAUSED]],
		},
		{ sql: 'machine.state <> ?', bindings: [MachineState.DECOMMISSIONED] },
		{ sql: 'organization."deletedAt" IS NULL', bindings: [] },
		visibleListingCondition(filter.customerOrganizationId),
		{
			sql: `machine.category IS NOT NULL
				AND machine."measuredVcpu" >= ? AND machine."measuredMemoryGib" >= ?
				AND machine."measuredDiskGib" >= ? AND machine."gpuCount" >= ?`,
			bindings: [
				filter.shape.cpu,
				filter.shape.memoryGiB,
				filter.shape.diskGiB,
				filter.shape.gpu,
			],
		},
		...optionalConditions(filter),
	];
	return {
		sql: `SELECT machine.id AS machine_id, machine.name,
				machine.country, machine.continent, machine.city,
				machine.latitude, machine.longitude,
				${HOST_DISPLAY_NAME_SQL} AS host_name, machine."organizationId" AS organization_id,
				machine.tier, machine.category, machine."cpuModel" AS cpu_model,
				machine."measuredVcpu" AS vcpu, machine."measuredMemoryGib" AS memory_gib,
				machine."measuredDiskGib" AS disk_gib, machine."gpuType" AS gpu_type,
				machine."gpuCount" AS gpu_count, machine."gpuMemoryGib" AS gpu_memory_gib,
				machine."gpuTflops" AS gpu_tflops, machine."cpuScorePerVcpu" AS cpu_score_per_vcpu,
				machine."cpuSingleThreadScore" AS cpu_single_thread_score,
				machine."memoryBandwidthMibps" AS memory_bandwidth_mibps,
				machine."memoryLatencyNs" AS memory_latency_ns,
				machine."diskRandomReadIops" AS disk_random_read_iops,
				machine."diskSequentialMibps" AS disk_sequential_mibps,
				machine."diskSequentialWriteMibps" AS disk_sequential_write_mibps,
				machine."diskReadLatencyMicros" AS disk_read_latency_micros,
				machine."diskFsyncLatencyMicros" AS disk_fsync_latency_micros,
				machine."networkDownlinkMbps" AS network_downlink_mbps,
				machine."networkUplinkMbps" AS network_uplink_mbps,
				machine."networkMinRttMs" AS network_min_rtt_ms,
				machine."networkLoadedRttMs" AS network_loaded_rtt_ms,
				machine."networkJitterMs" AS network_jitter_ms,
				machine."measuredAt" AS measured_at, machine."listedSince" AS listed_since,
				machine."createdAt" AS created_at,
				${RELIABILITY_SQL} AS reliability_basis_points,
				COALESCE(assessment."uptimeBasisPoints", 0) AS uptime_basis_points,
				listing.state AS listing_state, card.id AS price_card_id,
				${OFFER_CARD_COLUMNS_SQL},
				COALESCE((${host.sql}), false) AS online,
				COALESCE((${workload.sql}), false) AS fits
			FROM machine
			JOIN machine_listing listing ON listing."machineId" = machine.id
			JOIN organization ON organization.id = machine."organizationId"
			LEFT JOIN host_profile ON host_profile."organizationId" = organization.id
			LEFT JOIN machine_price_card card ON card.id = listing."currentPriceCardId"
			LEFT JOIN machine_assessment assessment ON assessment."machineId" = machine.id
			WHERE ${conditions.map((condition) => condition.sql).join('\n AND ')}
			ORDER BY machine.id ASC
			LIMIT ?`,
		bindings: [
			...host.bindings,
			...workload.bindings,
			...conditions.flatMap((condition) => condition.bindings),
			filter.limit,
		],
	};
}
