/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { MicroUsd } from '../../common/values/micro-usd.value';
import {
	ResourceShape,
	type ResourceShapeFields,
} from '../../common/values/resource-shape.value';
import { Continent } from '../../location/enums/continent.enum';
import { LocationConstraintKind } from '../../location/enums/location-constraint-kind.enum';
import { GpuType } from '../../machine/enums/gpu-type.enum';
import { ListingState } from '../enums/listing-state.enum';
import { MachineBrowseSort } from '../enums/machine-browse-sort.enum';
import { MachineCategory } from '../enums/machine-category.enum';
import { MachineTier } from '../enums/machine-tier.enum';
import { MachineUnavailableReason } from '../enums/machine-unavailable-reason.enum';
import type { MachineBrowseRow } from '../queries/machine-browse.query';
import {
	type BrowseFilterQuery,
	type BrowseMachine,
	type BrowseSelection,
	browseFilter,
	decodeBrowseCursor,
	encodeBrowseCursor,
	hostUnavailableReason,
	machineOffer,
	selectBrowsePage,
} from './machine-browse.util';

const CUSTOMER = 'customer-organization';
const LOCATION_GERMANY = 'DE';
const FRANKFURT = {
	country: LOCATION_GERMANY,
	continent: Continent.EUROPE,
	city: 'Frankfurt am Main',
	latitude: 50.11,
	longitude: 8.68,
};
const PARIS = {
	country: 'FR',
	continent: Continent.EUROPE,
	city: 'Paris',
	latitude: 48.86,
	longitude: 2.35,
};
const HOST = 'host-organization';
const MARKUP_BASIS_POINTS = 2_500;
const SHAPE: ResourceShapeFields = {
	cpu: 2,
	memoryGiB: 4,
	diskGiB: 20,
	gpu: 0,
};
const HOST_HOURLY_MICRO_USD = MicroUsd.of(30_000n);
const GROSS_HOURLY_MICRO_USD = MicroUsd.of(37_500n);

function row(changes: Partial<MachineBrowseRow> = {}): MachineBrowseRow {
	return {
		machine_id: randomUUID(),
		name: 'machine',
		country: FRANKFURT.country,
		continent: FRANKFURT.continent,
		city: FRANKFURT.city,
		latitude: FRANKFURT.latitude,
		longitude: FRANKFURT.longitude,
		host_name: 'Host',
		organization_id: HOST,
		tier: MachineTier.COMMUNITY,
		category: MachineCategory.GENERAL,
		cpu_model: 'cpu',
		vcpu: 16,
		memory_gib: 64,
		disk_gib: 500,
		gpu_type: null,
		gpu_count: 0,
		gpu_memory_gib: 0,
		gpu_tflops: 0,
		cpu_single_thread_score: null,
		cpu_score_per_vcpu: 1_000,
		memory_bandwidth_mibps: null,
		memory_latency_ns: null,
		disk_random_read_iops: null,
		disk_sequential_mibps: null,
		disk_sequential_write_mibps: null,
		disk_read_latency_micros: null,
		disk_fsync_latency_micros: null,
		network_downlink_mbps: null,
		network_uplink_mbps: null,
		network_min_rtt_ms: null,
		network_loaded_rtt_ms: null,
		network_jitter_ms: null,
		measured_at: new Date('2026-10-01T00:00:00Z'),
		listed_since: new Date('2026-10-02T00:00:00Z'),
		created_at: new Date('2026-09-30T00:00:00Z'),
		reliability_basis_points: 9_000,
		uptime_basis_points: 9_900,
		listing_state: ListingState.LISTED,
		price_card_id: randomUUID(),
		vcpu_hour_micro_usd: '10000',
		memory_gib_hour_micro_usd: '2000',
		gpu_hour_micro_usd: '0',
		disk_gib_month_micro_usd: '73000',
		stopped_disk_gib_month_micro_usd: '36500',
		egress_micro_usd_per_gib: '20000',
		online: true,
		fits: true,
		...changes,
	};
}

function machine(changes: Partial<MachineBrowseRow> = {}): BrowseMachine {
	const browseRow = row(changes);
	const offer = machineOffer(browseRow, SHAPE, CUSTOMER, MARKUP_BASIS_POINTS);
	assert.ok(offer);
	return {
		row: browseRow,
		offer,
		selfUse: browseRow.organization_id === CUSTOMER,
		unavailableReason: hostUnavailableReason(browseRow),
	};
}

function selection(changes: Partial<BrowseSelection> = {}): BrowseSelection {
	return {
		sort: MachineBrowseSort.PRICE,
		origin: null,
		shape: SHAPE,
		includeUnavailable: false,
		limit: 10,
		...changes,
	};
}

function ids(machines: readonly BrowseMachine[]): string[] {
	return machines.map((entry) => entry.row.machine_id);
}

describe('machine offers', () => {
	it('prices the shape all-in with the platform markup', () => {
		const offer = machineOffer(row(), SHAPE, CUSTOMER, MARKUP_BASIS_POINTS);

		assert.deepEqual(offer?.hourly.hostMicroUsd, HOST_HOURLY_MICRO_USD);
		assert.deepEqual(offer?.hourly.grossMicroUsd, GROSS_HOURLY_MICRO_USD);
		assert.deepEqual(offer?.stopped.hostMicroUsd, MicroUsd.of(1_000n));
		assert.equal(offer?.markupBasisPoints, MARKUP_BASIS_POINTS);
	});

	it('shows the own machines unpriced', () => {
		const offer = machineOffer(
			row({ organization_id: CUSTOMER, price_card_id: null }),
			SHAPE,
			CUSTOMER,
			MARKUP_BASIS_POINTS
		);

		assert.equal(offer?.priceCardId, null);
		assert.deepEqual(offer?.hourly.grossMicroUsd, MicroUsd.ZERO);
	});

	it('cannot price another host without a card', () => {
		assert.equal(
			machineOffer(
				row({ price_card_id: null, vcpu_hour_micro_usd: null }),
				SHAPE,
				CUSTOMER,
				MARKUP_BASIS_POINTS
			),
			null
		);
	});
});

describe('availability', () => {
	it('reports paused before offline before full', () => {
		assert.equal(
			hostUnavailableReason(
				row({ listing_state: ListingState.PAUSED, online: false, fits: false })
			),
			MachineUnavailableReason.PAUSED
		);
		assert.equal(
			hostUnavailableReason(row({ online: false, fits: false })),
			MachineUnavailableReason.OFFLINE
		);
		assert.equal(
			hostUnavailableReason(row({ fits: false })),
			MachineUnavailableReason.FULL
		);
		assert.equal(hostUnavailableReason(row()), null);
	});
});

describe('browse ranking and pagination', () => {
	const cheap = machine({
		vcpu_hour_micro_usd: '5000',
		reliability_basis_points: 6_000,
	});
	const middle = machine({ reliability_basis_points: 9_900 });
	const dear = machine({
		vcpu_hour_micro_usd: '20000',
		reliability_basis_points: 8_000,
	});
	const offline = machine({ vcpu_hour_micro_usd: '1000', online: false });
	const machines = [dear, offline, middle, cheap];

	it('sorts by all-in price and hides unavailable machines by default', () => {
		const page = selectBrowsePage(machines, selection());

		assert.deepEqual(ids(page.items), ids([cheap, middle, dear]));
		assert.equal(page.total, 3);
		assert.equal(page.nextCursor, null);
	});

	it('includes unavailable machines on request', () => {
		const page = selectBrowsePage(
			machines,
			selection({ includeUnavailable: true })
		);

		assert.deepEqual(ids(page.items), ids([offline, cheap, middle, dear]));
	});

	it('sorts by reliability, best first', () => {
		const page = selectBrowsePage(
			machines,
			selection({ sort: MachineBrowseSort.RELIABILITY })
		);

		assert.deepEqual(ids(page.items), ids([middle, dear, cheap]));
	});

	it('drops machines above the hourly price cap', () => {
		const page = selectBrowsePage(
			machines,
			selection({ maxHourlyPriceMicroUsd: GROSS_HOURLY_MICRO_USD })
		);

		assert.deepEqual(ids(page.items), ids([cheap, middle]));
	});

	it('pages with a keyset cursor', () => {
		const first = selectBrowsePage(machines, selection({ limit: 2 }));
		assert.deepEqual(ids(first.items), ids([cheap, middle]));
		assert.ok(first.nextCursor);

		const cursor = decodeBrowseCursor(first.nextCursor);
		assert.ok(cursor);
		const second = selectBrowsePage(machines, selection({ limit: 2, cursor }));
		assert.deepEqual(ids(second.items), ids([dear]));
		assert.equal(second.nextCursor, null);
		assert.equal(second.total, 3);
	});

	it('sorts nearest first and puts machines of unknown location last', () => {
		const paris = machine({
			country: PARIS.country,
			city: PARIS.city,
			latitude: PARIS.latitude,
			longitude: PARIS.longitude,
		});
		const frankfurt = machine();
		const unknown = machine({ latitude: null, longitude: null });
		const page = selectBrowsePage(
			[unknown, frankfurt, paris],
			selection({ sort: MachineBrowseSort.NEAREST, origin: PARIS })
		);

		assert.deepEqual(ids(page.items), ids([paris, frankfurt, unknown]));
	});

	it('breaks price ties by machine id', () => {
		const tied = [machine(), machine(), machine()];
		const page = selectBrowsePage(tied, selection());

		assert.deepEqual(ids(page.items), ids(tied).sort());
	});
});

describe('browse cursors', () => {
	it('round-trips negative keys and rejects malformed cursors', () => {
		const cursor = { key: -9_900n, machineId: randomUUID() };

		assert.deepEqual(decodeBrowseCursor(encodeBrowseCursor(cursor)), cursor);
		assert.equal(decodeBrowseCursor('not-a-cursor'), null);
		assert.equal(
			decodeBrowseCursor(Buffer.from('12:not-a-uuid').toString('base64url')),
			null
		);
	});
});

describe('browse filter mapping', () => {
	it('maps the query to the candidate filter', () => {
		const query: BrowseFilterQuery = {
			cpu: 4,
			memoryGiB: 8,
			diskGiB: 40,
			gpu: 1,
			gpuType: [GpuType.H100],
			category: MachineCategory.GPU,
			locations: [LOCATION_GERMANY, Continent.EUROPE],
			minimumTier: MachineTier.VERIFIED,
			minimumReliabilityBasisPoints: 9_000,
			persistentVolumes: true,
		};

		const filter = browseFilter(query, CUSTOMER);

		assert.deepEqual(
			filter.shape,
			ResourceShape.of({ cpu: 4, memoryGiB: 8, diskGiB: 40, gpu: 1 })
		);
		assert.deepEqual(filter.tiers, [
			MachineTier.VERIFIED,
			MachineTier.DATACENTER,
		]);
		assert.deepEqual(filter.gpuTypes, [GpuType.H100]);
		assert.equal(filter.category, MachineCategory.GPU);
		assert.equal(filter.customerOrganizationId, CUSTOMER);
		assert.equal(filter.persistentVolumes, true);
		assert.deepEqual(filter.locations, [
			{ kind: LocationConstraintKind.COUNTRY, country: LOCATION_GERMANY },
			{ kind: LocationConstraintKind.CONTINENT, continent: Continent.EUROPE },
		]);
	});
});
