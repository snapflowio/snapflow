/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { isUUID } from 'class-validator';
import { MicroUsd } from '../../common/values/micro-usd.value';
import {
	ResourceShape,
	type ResourceShapeFields,
} from '../../common/values/resource-shape.value';
import { parseDatabaseTimestamp } from '../../infra/database/utils/database-time.util';
import type { GeoPoint } from '../../location/types/geo-location.types';
import { distanceKm, geoPoint } from '../../location/utils/geo-distance.util';
import { parseLocationConstraint } from '../../location/utils/location-constraint.util';
import {
	MACHINE_BROWSE_CANDIDATE_LIMIT,
	MACHINE_BROWSE_CURSOR_SEPARATOR,
	SELF_USE_MARKUP_BASIS_POINTS,
} from '../constants/marketplace.constants';
import type {
	ListListingsQueryDto,
	MachineShapeQueryDto,
} from '../dto/machine-browse-query.dto';
import { ListingState } from '../enums/listing-state.enum';
import { MachineBrowseSort } from '../enums/machine-browse-sort.enum';
import { MachineUnavailableReason } from '../enums/machine-unavailable-reason.enum';
import type {
	MachineBrowseFilter,
	MachineBrowseRow,
} from '../queries/machine-browse.query';
import type { LinePrice } from '../types/pricing.types';
import { tiersAtLeast } from './machine-tier.util';
import {
	egressPricePerGiB,
	priceTerms,
	runningHourlyPrice,
	stoppedHourlyPrice,
	ZERO_LINE_PRICE,
} from './pricing.util';

const CURSOR_KEY_PATTERN = /^-?\d+$/;

const UNKNOWN_DISTANCE_KEY = BigInt(Number.MAX_SAFE_INTEGER);

export interface MachineOffer {
	priceCardId: string | null;
	markupBasisPoints: number;
	hourly: LinePrice;
	stopped: LinePrice;
	egressPerGiB: LinePrice;
}

export interface BrowseMachine {
	row: MachineBrowseRow;
	offer: MachineOffer;
	selfUse: boolean;
	unavailableReason: MachineUnavailableReason | null;
}

export interface BrowseCursor {
	key: bigint;
	machineId: string;
}

export interface BrowseSelection {
	sort: MachineBrowseSort;
	origin: GeoPoint | null;
	shape: ResourceShapeFields;
	maxHourlyPriceMicroUsd?: MicroUsd;
	maxEgressMicroUsdPerGiB?: MicroUsd;
	includeUnavailable: boolean;
	cursor?: BrowseCursor;
	limit: number;
}

export interface BrowsePage {
	items: BrowseMachine[];
	nextCursor: string | null;
	total: number;
}

export function browseShape(query: MachineShapeQueryDto): ResourceShape {
	return ResourceShape.of(query);
}

export type BrowseFilterQuery = Pick<
	ListListingsQueryDto,
	| 'cpu'
	| 'memoryGiB'
	| 'diskGiB'
	| 'gpu'
	| 'category'
	| 'gpuType'
	| 'locations'
	| 'minimumTier'
	| 'minimumReliabilityBasisPoints'
	| 'persistentVolumes'
>;

export function browseFilter(
	query: BrowseFilterQuery,
	customerOrganizationId: string
): MachineBrowseFilter {
	return {
		customerOrganizationId,
		shape: browseShape(query),
		category: query.category,
		gpuTypes: query.gpuType,
		locations: query.locations?.map(parseLocationConstraint),
		tiers: query.minimumTier ? tiersAtLeast(query.minimumTier) : undefined,
		minimumReliabilityBasisPoints: query.minimumReliabilityBasisPoints,
		persistentVolumes: query.persistentVolumes,
		limit: MACHINE_BROWSE_CANDIDATE_LIMIT,
	};
}

export function browseSelection(
	query: ListListingsQueryDto,
	cursor: BrowseCursor | undefined,
	origin: GeoPoint | null
): BrowseSelection {
	return {
		sort: query.sort,
		origin,
		shape: browseShape(query),
		maxHourlyPriceMicroUsd:
			query.maxHourlyPriceMicroUsd === undefined
				? undefined
				: MicroUsd.parse(query.maxHourlyPriceMicroUsd),
		maxEgressMicroUsdPerGiB:
			query.maxEgressMicroUsdPerGiB === undefined
				? undefined
				: MicroUsd.parse(query.maxEgressMicroUsdPerGiB),
		includeUnavailable: query.includeUnavailable,
		cursor,
		limit: query.limit,
	};
}

export function machineOffer(
	row: MachineBrowseRow,
	shape: ResourceShapeFields,
	customerOrganizationId: string,
	markupBasisPoints: number
): MachineOffer | null {
	if (row.organization_id === customerOrganizationId) {
		return {
			priceCardId: null,
			markupBasisPoints: SELF_USE_MARKUP_BASIS_POINTS,
			hourly: ZERO_LINE_PRICE,
			stopped: ZERO_LINE_PRICE,
			egressPerGiB: ZERO_LINE_PRICE,
		};
	}
	if (
		row.price_card_id === null ||
		row.vcpu_hour_micro_usd === null ||
		row.memory_gib_hour_micro_usd === null ||
		row.gpu_hour_micro_usd === null ||
		row.disk_gib_month_micro_usd === null ||
		row.stopped_disk_gib_month_micro_usd === null ||
		row.egress_micro_usd_per_gib === null
	) {
		return null;
	}
	const terms = priceTerms(
		{
			vcpuHourMicroUsd: row.vcpu_hour_micro_usd,
			memoryGibHourMicroUsd: row.memory_gib_hour_micro_usd,
			gpuHourMicroUsd: row.gpu_hour_micro_usd,
			diskGibMonthMicroUsd: row.disk_gib_month_micro_usd,
			stoppedDiskGibMonthMicroUsd: row.stopped_disk_gib_month_micro_usd,
			egressMicroUsdPerGiB: row.egress_micro_usd_per_gib,
		},
		markupBasisPoints
	);
	return {
		priceCardId: row.price_card_id,
		markupBasisPoints,
		hourly: runningHourlyPrice(terms, shape),
		stopped: stoppedHourlyPrice(terms, shape),
		egressPerGiB: egressPricePerGiB(terms),
	};
}

export function hostUnavailableReason(
	row: MachineBrowseRow
): MachineUnavailableReason | null {
	if (row.listing_state !== ListingState.LISTED) {
		return MachineUnavailableReason.PAUSED;
	}
	if (!row.online) return MachineUnavailableReason.OFFLINE;
	return row.fits ? null : MachineUnavailableReason.FULL;
}

function performanceScore(
	row: MachineBrowseRow,
	shape: ResourceShapeFields
): number {
	return shape.gpu > 0 ? row.gpu_tflops : (row.cpu_score_per_vcpu ?? 0);
}

function distanceKey(machine: BrowseMachine, origin: GeoPoint | null): bigint {
	const point = geoPoint(machine.row);
	if (!origin) return 0n;
	if (!point) return UNKNOWN_DISTANCE_KEY;
	return BigInt(Math.round(distanceKm(origin, point)));
}

export function rankKey(
	machine: BrowseMachine,
	{ sort, shape, origin }: Pick<BrowseSelection, 'sort' | 'shape' | 'origin'>
): bigint {
	switch (sort) {
		case MachineBrowseSort.PRICE:
			return machine.offer.hourly.grossMicroUsd.toBigInt();
		case MachineBrowseSort.RELIABILITY:
			return -BigInt(machine.row.reliability_basis_points);
		case MachineBrowseSort.PERFORMANCE:
			return -BigInt(performanceScore(machine.row, shape));
		case MachineBrowseSort.NEWEST:
			return -BigInt(
				parseDatabaseTimestamp(
					machine.row.listed_since ?? machine.row.created_at
				).getTime()
			);
		case MachineBrowseSort.NEAREST:
			return distanceKey(machine, origin);
	}
}

function compareCursors(left: BrowseCursor, right: BrowseCursor): number {
	if (left.key !== right.key) return left.key < right.key ? -1 : 1;
	if (left.machineId === right.machineId) return 0;
	return left.machineId < right.machineId ? -1 : 1;
}

export function encodeBrowseCursor(cursor: BrowseCursor): string {
	return Buffer.from(
		`${cursor.key}${MACHINE_BROWSE_CURSOR_SEPARATOR}${cursor.machineId}`
	).toString('base64url');
}

export function decodeBrowseCursor(value: string): BrowseCursor | null {
	const decoded = Buffer.from(value, 'base64url').toString('utf8');
	const separator = decoded.lastIndexOf(MACHINE_BROWSE_CURSOR_SEPARATOR);
	const key = decoded.slice(0, separator);
	const machineId = decoded.slice(
		separator + MACHINE_BROWSE_CURSOR_SEPARATOR.length
	);
	if (separator <= 0 || !CURSOR_KEY_PATTERN.test(key) || !isUUID(machineId)) {
		return null;
	}
	return { key: BigInt(key), machineId };
}

export function selectBrowsePage(
	machines: readonly BrowseMachine[],
	selection: BrowseSelection
): BrowsePage {
	const ranked = machines
		.filter(
			(machine) =>
				(selection.includeUnavailable || machine.unavailableReason === null) &&
				(selection.maxHourlyPriceMicroUsd === undefined ||
					machine.offer.hourly.grossMicroUsd.atMost(
						selection.maxHourlyPriceMicroUsd
					)) &&
				(selection.maxEgressMicroUsdPerGiB === undefined ||
					machine.offer.egressPerGiB.grossMicroUsd.atMost(
						selection.maxEgressMicroUsdPerGiB
					))
		)
		.map((machine) => ({
			machine,
			cursor: {
				key: rankKey(machine, selection),
				machineId: machine.row.machine_id,
			},
		}))
		.sort((left, right) => compareCursors(left.cursor, right.cursor));
	const after = selection.cursor;
	const remaining = after
		? ranked.filter((entry) => compareCursors(entry.cursor, after) > 0)
		: ranked;
	const page = remaining.slice(0, selection.limit);
	const last = page.at(-1);
	return {
		items: page.map((entry) => entry.machine),
		nextCursor:
			remaining.length > selection.limit && last
				? encodeBrowseCursor(last.cursor)
				: null,
		total: ranked.length,
	};
}
