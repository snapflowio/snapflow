/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EntityManager } from '@mikro-orm/postgresql';
import { NotFoundException } from '@nestjs/common';
import { fakeInstance } from '../../../common/testing/instance.fake';
import { Continent } from '../../../location/enums/continent.enum';
import { LocationConstraintKind } from '../../../location/enums/location-constraint-kind.enum';
import { GeoIpService } from '../../../location/services/geo-ip.service';
import type { GeoLocation } from '../../../location/types/geo-location.types';
import { MachineListing } from '../../../marketplace/entities/machine-listing.entity';
import { ListingVisibility } from '../../../marketplace/enums/listing-visibility.enum';
import { PlacementKind } from '../../../marketplace/enums/placement-kind.enum';
import { Machine } from '../../machine/entities/machine.entity';
import { SandboxPlacementResolverService } from './sandbox-placement-resolver.service';

const ORGANIZATION_ID = '4d000000-0000-4000-8000-000000000001';
const OTHER_ORGANIZATION_ID = '4d000000-0000-4000-8000-000000000002';
const OWN_MACHINE_ID = '4d000000-0000-4000-8000-0000000000a1';
const PUBLIC_MACHINE_ID = '4d000000-0000-4000-8000-0000000000a2';
const PRIVATE_FOREIGN_MACHINE_ID = '4d000000-0000-4000-8000-0000000000a3';
const CALLER_ADDRESS = '198.51.100.20';
const COUNTRY = 'DE';
const CALLER: GeoLocation = {
	country: COUNTRY,
	continent: Continent.EUROPE,
	city: 'Berlin',
	latitude: 52.52,
	longitude: 13.4,
};

const MACHINES = new Map([
	[
		OWN_MACHINE_ID,
		{ organizationId: ORGANIZATION_ID, visibility: ListingVisibility.PRIVATE },
	],
	[
		PUBLIC_MACHINE_ID,
		{
			organizationId: OTHER_ORGANIZATION_ID,
			visibility: ListingVisibility.PUBLIC,
		},
	],
	[
		PRIVATE_FOREIGN_MACHINE_ID,
		{
			organizationId: OTHER_ORGANIZATION_ID,
			visibility: ListingVisibility.PRIVATE,
		},
	],
]);

function resolver(): SandboxPlacementResolverService {
	const manager = fakeInstance(EntityManager, {
		findOne: async (entity: unknown, where: Record<string, string>) => {
			const id = where.id ?? where.machineId;
			const machine = id === undefined ? undefined : MACHINES.get(id);
			if (!machine) return null;
			return entity === MachineListing
				? fakeInstance(MachineListing, { visibility: machine.visibility })
				: fakeInstance(Machine, {
						id,
						organizationId: machine.organizationId,
					});
		},
	});
	const geoIp = fakeInstance(GeoIpService, {
		locate: (address: string | undefined) =>
			address === CALLER_ADDRESS ? CALLER : null,
	});
	return new SandboxPlacementResolverService(manager, geoIp);
}

describe('SandboxPlacementResolverService.resolvePlacement', () => {
	it('places flexibly near the caller when no location is requested', async () => {
		const resolved = await resolver().resolvePlacement(
			ORGANIZATION_ID,
			undefined,
			CALLER_ADDRESS
		);

		assert.equal(resolved.ownMachinesOnly, false);
		assert.deepEqual(resolved.request, {
			kind: PlacementKind.FLEXIBLE,
			locations: [],
			ownMachinesOnly: false,
			origin: { latitude: CALLER.latitude, longitude: CALLER.longitude },
			category: undefined,
			minimumTier: undefined,
			maxHourlyPriceMicroUsd: undefined,
			maxEgressMicroUsdPerGiB: undefined,
		});
	});

	it('keeps the requested locations in order without duplicates', async () => {
		const resolved = await resolver().resolvePlacement(
			ORGANIZATION_ID,
			{
				kind: PlacementKind.FLEXIBLE,
				locations: [COUNTRY, Continent.EUROPE, COUNTRY],
			},
			CALLER_ADDRESS
		);

		assert.ok(resolved.request.kind === PlacementKind.FLEXIBLE);
		assert.deepEqual(resolved.request.locations, [
			{ kind: LocationConstraintKind.COUNTRY, country: COUNTRY },
			{ kind: LocationConstraintKind.CONTINENT, continent: Continent.EUROPE },
		]);
	});

	it('has no origin when the caller cannot be located', async () => {
		const resolved = await resolver().resolvePlacement(
			ORGANIZATION_ID,
			{ kind: PlacementKind.FLEXIBLE, ownMachinesOnly: true },
			undefined
		);

		assert.ok(resolved.request.kind === PlacementKind.FLEXIBLE);
		assert.equal(resolved.request.origin, null);
		assert.equal(resolved.request.ownMachinesOnly, true);
		assert.equal(resolved.ownMachinesOnly, true);
	});

	it('treats a sandbox pinned to an own machine as running on own machines', async () => {
		const resolved = await resolver().resolvePlacement(
			ORGANIZATION_ID,
			{ kind: PlacementKind.PINNED, machineId: OWN_MACHINE_ID },
			CALLER_ADDRESS
		);

		assert.equal(resolved.ownMachinesOnly, true);
		assert.deepEqual(resolved.request, {
			kind: PlacementKind.PINNED,
			machineId: OWN_MACHINE_ID,
		});
	});

	it('pins to a public machine of another organization as a marketplace placement', async () => {
		const resolved = await resolver().resolvePlacement(
			ORGANIZATION_ID,
			{ kind: PlacementKind.PINNED, machineId: PUBLIC_MACHINE_ID },
			CALLER_ADDRESS
		);

		assert.equal(resolved.ownMachinesOnly, false);
	});

	it('hides private machines of other organizations', async () => {
		await assert.rejects(
			resolver().resolvePlacement(
				ORGANIZATION_ID,
				{ kind: PlacementKind.PINNED, machineId: PRIVATE_FOREIGN_MACHINE_ID },
				CALLER_ADDRESS
			),
			NotFoundException
		);
	});
});

describe('SandboxPlacementResolverService.runsOnOwnMachines', () => {
	const sandbox = {
		organizationId: ORGANIZATION_ID,
		placementKind: PlacementKind.FLEXIBLE,
		pinnedMachineId: null,
		placementOwnMachinesOnly: false,
	};

	it('follows the flexible own-machines flag', async () => {
		assert.equal(await resolver().runsOnOwnMachines(sandbox), false);
		assert.equal(
			await resolver().runsOnOwnMachines({
				...sandbox,
				placementOwnMachinesOnly: true,
			}),
			true
		);
	});

	it('checks who owns the pinned machine', async () => {
		const pinned = { ...sandbox, placementKind: PlacementKind.PINNED };
		assert.equal(
			await resolver().runsOnOwnMachines({
				...pinned,
				pinnedMachineId: OWN_MACHINE_ID,
			}),
			true
		);
		assert.equal(
			await resolver().runsOnOwnMachines({
				...pinned,
				pinnedMachineId: PUBLIC_MACHINE_ID,
			}),
			false
		);
	});
});
