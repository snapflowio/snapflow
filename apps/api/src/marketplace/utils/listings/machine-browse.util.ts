/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { isUUID } from 'class-validator';
import { MicroUsd } from '../../../common/values/micro-usd.value';
import {
	ResourceShape,
	type ResourceShapeFields,
} from '../../../common/values/resource-shape.value';
import { parseDatabaseTimestamp } from '../../../infra/database/utils/database-time.util';
import type { GeoPoint } from '../../../location/types/geo-location.types';
import {
	distanceKm,
	geoPoint,
} from '../../../location/utils/geo-distance.util';
import { parseLocationConstraint } from '../../../location/utils/location-constraint.util';
import {
	MACHINE_BROWSE_CANDIDATE_LIMIT,
	MACHINE_BROWSE_CURSOR_SEPARATOR,
	SELF_USE_MARKUP_BASIS_POINTS,
} from '../../constants/marketplace.constants';
import type {
	ListListingsQueryDto,
	MachineShapeQueryDto,
} from '../../dto/machine-browse-query.dto';
import { ListingState } from '../../enums/listing-state.enum';
import { MachineBrowseSort } from '../../enums/machine-browse-sort.enum';
import { MachineUnavailableReason } from '../../enums/machine-unavailable-reason.enum';
import type {
	MachineBrowseFilter,
	MachineBrowseRow,
} from '../../queries/machine-browse.query';
import type { OfferCardRow } from '../../queries/offer-card-columns.query';
import type { LinePrice, PriceCardTerms } from '../../types/pricing.types';
import {
	type MarkupSettings,
	marketMarkupBasisPoints,
} from '../pricing/markup.util';
import {
	priceTerms,
	runningHourlyPrice,
	stoppedHourlyPrice,
	ZERO_LINE_PRICE,
} from '../pricing/pricing.util';
import { shapeFits, wholeMachineShape } from '../pricing/slice-pricing.util';
import { tiersAtLeast } from './machine-tier.util';

const CURSOR_KEY_PATTERN = /^-?\d+$/;

const UNKNOWN_DISTANCE_KEY = BigInt(Number.MAX_SAFE_INTEGER);

const MINIMUM_VALUE_PRICE = MicroUsd.of(1n);

const VALUE_KEY_SCALE = 1_000_000;

export interface MachineOffer {
	priceCardId: string | null;
	markupBasisPoints: number;
	hourly: LinePrice;
	stopped: LinePrice;
	wholeMachineHourly: LinePrice;
}

export interface BrowseMachine {
	row: MachineBrowseRow;
	offer: MachineOffer;
	selfUse: boolean;
	unavailableReason: MachineUnavailableReason | null;
}

interface BrowseCursor {
	key: bigint;
	machineId: string;
}

export interface BrowseSelection {
	sort: MachineBrowseSort;
	origin: GeoPoint | null;
	shape: ResourceShapeFields;
	maxHourlyPriceMicroUsd?: MicroUsd;
	includeUnavailable: boolean;
	cursor?: BrowseCursor;
	limit: number;
}

interface BrowsePage {
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
	| 'minimumGpuMemoryGiB'
	| 'search'
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
		minimumGpuMemoryGiB: query.minimumGpuMemoryGiB,
		search: query.search,
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
		includeUnavailable: query.includeUnavailable,
		cursor,
		limit: query.limit,
	};
}

export function offerCard(row: OfferCardRow): PriceCardTerms | null {
	if (
		row.vcpu_hour_micro_usd === null ||
		row.memory_gib_hour_micro_usd === null ||
		row.gpu_hour_micro_usd === null ||
		row.disk_gib_month_micro_usd === null ||
		row.card_vcpu === null ||
		row.card_memory_gib === null ||
		row.card_gpu_count === null ||
		row.card_interruptible_basis_points === null
	) {
		return null;
	}
	return {
		vcpuHourMicroUsd: row.vcpu_hour_micro_usd,
		memoryGibHourMicroUsd: row.memory_gib_hour_micro_usd,
		gpuHourMicroUsd: row.gpu_hour_micro_usd,
		diskGibMonthMicroUsd: row.disk_gib_month_micro_usd,
		vcpu: row.card_vcpu,
		memoryGib: row.card_memory_gib,
		gpuCount: row.card_gpu_count,
		interruptibleBasisPoints: row.card_interruptible_basis_points,
	};
}

export function offerFits(
	card: PriceCardTerms,
	row: Pick<OfferCardRow, 'gpu_only'>,
	shape: ResourceShapeFields
): boolean {
	return shapeFits(card, shape) && (!row.gpu_only || shape.gpu > 0);
}

export function machineOffer(
	row: OfferCardRow & { organization_id: string },
	shape: ResourceShapeFields,
	customerOrganizationId: string,
	settings: MarkupSettings
): MachineOffer | null {
	if (row.organization_id === customerOrganizationId) {
		return {
			priceCardId: null,
			markupBasisPoints: SELF_USE_MARKUP_BASIS_POINTS,
			hourly: ZERO_LINE_PRICE,
			stopped: ZERO_LINE_PRICE,
			wholeMachineHourly: ZERO_LINE_PRICE,
		};
	}
	const card = offerCard(row);
	if (
		row.price_card_id === null ||
		card === null ||
		!offerFits(card, row, shape)
	) {
		return null;
	}
	const markupBasisPoints = marketMarkupBasisPoints(settings);
	const terms = priceTerms(card, shape, markupBasisPoints);
	const whole = wholeMachineShape(card, shape.diskGiB);
	return {
		priceCardId: row.price_card_id,
		markupBasisPoints,
		hourly: runningHourlyPrice(terms, shape),
		stopped: stoppedHourlyPrice(terms, shape),
		wholeMachineHourly: runningHourlyPrice(
			priceTerms(card, whole, markupBasisPoints),
			whole
		),
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

function valueScore(
	machine: BrowseMachine,
	shape: ResourceShapeFields
): number {
	const price = machine.offer.hourly.grossMicroUsd.max(MINIMUM_VALUE_PRICE);
	return (
		(performanceScore(machine.row, shape) *
			machine.row.reliability_basis_points) /
		Number(price.toBigInt())
	);
}

function distanceKey(machine: BrowseMachine, origin: GeoPoint | null): bigint {
	const point = geoPoint(machine.row);
	if (!origin) return 0n;
	if (!point) return UNKNOWN_DISTANCE_KEY;
	return BigInt(Math.round(distanceKm(origin, point)));
}

function rankKey(
	machine: BrowseMachine,
	{ sort, shape, origin }: Pick<BrowseSelection, 'sort' | 'shape' | 'origin'>
): bigint {
	switch (sort) {
		case MachineBrowseSort.VALUE:
			return -BigInt(Math.round(valueScore(machine, shape) * VALUE_KEY_SCALE));
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

function encodeBrowseCursor(cursor: BrowseCursor): string {
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
