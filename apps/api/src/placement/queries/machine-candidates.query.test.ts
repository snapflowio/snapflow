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
import { Continent } from '../../location/enums/continent.enum';
import { LocationConstraintKind } from '../../location/enums/location-constraint-kind.enum';
import type { LocationConstraint } from '../../location/types/geo-location.types';
import { SANDBOX_STATES_CONVERGING } from '../../machine/constants/machine-placement.constants';
import { GpuType } from '../../machine/enums/gpu-type.enum';
import type {
	FlexiblePlacement,
	GetMachineParams,
} from '../../machine/types/machine-scheduling.types';
import { MachineCategory } from '../../marketplace/enums/machine-category.enum';
import { MachineTier } from '../../marketplace/enums/machine-tier.enum';
import { PlacementKind } from '../../marketplace/enums/placement-kind.enum';
import {
	hostGateSql,
	workloadGateSql,
} from '../../marketplace/queries/machine-eligibility.query';
import { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';
import { SnapshotMachineState } from '../../snapshot/enums/snapshot-machine-state.enum';
import { machineCandidatesQuery } from './machine-candidates.query';

const SNAPSHOT_REF = 'registry.example.com/snapflow/base:1.0';
const WORKLOAD_FINGERPRINT = `sha256:${'a'.repeat(64)}`;
const MACHINE_ID = '1a000000-0000-4000-8000-000000000001';
const CUSTOMER_ID = '2b000000-0000-4000-8000-000000000002';
const COUNTRY = 'DE';
const ANYWHERE: FlexiblePlacement = {
	kind: PlacementKind.FLEXIBLE,
	locations: [],
	ownMachinesOnly: false,
	origin: null,
};
const COUNTRY_CONSTRAINT: LocationConstraint = {
	kind: LocationConstraintKind.COUNTRY,
	country: COUNTRY,
};
const LOCATIONS: LocationConstraint[] = [
	COUNTRY_CONSTRAINT,
	{ kind: LocationConstraintKind.CONTINENT, continent: Continent.EUROPE },
];
const PARAMETERS: GetMachineParams = {
	customerOrganizationId: CUSTOMER_ID,
	placement: ANYWHERE,
	sandboxClass: SandboxClass.LINUX_VM,
	gpu: 0,
	gpuType: null,
};

function placeholders(sql: string): number {
	return sql.split('?').length - 1;
}

describe('machineCandidatesQuery', () => {
	it('reports whether each machine holds the snapshot, without requiring it', () => {
		const { sql, bindings } = machineCandidatesQuery({
			...PARAMETERS,
			snapshotRef: SNAPSHOT_REF,
		});

		assert.match(
			sql,
			/LEFT JOIN snapshot_machine ON snapshot_machine\."machineId" = machine\.id/
		);
		assert.match(sql, /AS snapshot_present/);
		assert.doesNotMatch(sql, /snapshot_machine\.id IS NOT NULL\)/);
		assert.ok(bindings.includes(SNAPSHOT_REF));
		assert.ok(bindings.includes(SnapshotMachineState.PRESENT));
	});

	it('requires a holder for a snapshot no registry serves', () => {
		const { sql } = machineCandidatesQuery({
			...PARAMETERS,
			snapshotRef: SNAPSHOT_REF,
			snapshotRequired: true,
		});

		assert.match(sql, /\(snapshot_machine\.id IS NOT NULL\)/);
	});

	it('joins the marketplace listing and the current price card', () => {
		const { sql, bindings } = machineCandidatesQuery(PARAMETERS);

		assert.match(
			sql,
			/JOIN machine_listing listing ON listing\."machineId" = machine\.id/
		);
		assert.match(sql, /LEFT JOIN machine_price_card card/);
		assert.match(sql, /AS vcpu_hour_micro_usd/);
		assert.match(sql, /AS stopped_disk_gib_month_micro_usd/);
		assert.ok(bindings.includes(CUSTOMER_ID));
		assert.ok(bindings.includes(MachineTier.PRIVATE));
	});

	it('pins a single machine and skips the location filter', () => {
		const { sql, bindings } = machineCandidatesQuery({
			...PARAMETERS,
			placement: { kind: PlacementKind.PINNED, machineId: MACHINE_ID },
		});

		assert.match(sql, /\(machine\.id = \?\)/);
		assert.doesNotMatch(sql, /machine\.country = ANY/);
		assert.ok(bindings.includes(MACHINE_ID));
	});

	it('filters flexible placement by category and minimum tier', () => {
		const { sql, bindings } = machineCandidatesQuery({
			...PARAMETERS,
			placement: {
				...ANYWHERE,
				category: MachineCategory.HIGH_MEMORY,
				minimumTier: MachineTier.VERIFIED,
			},
		});

		assert.match(sql, /machine\.category = \?/);
		assert.match(sql, /array_position/);
		assert.ok(bindings.includes(MachineCategory.HIGH_MEMORY));
		assert.ok(bindings.includes(MachineTier.VERIFIED));
	});

	it('places anywhere when no location is requested', () => {
		const { sql } = machineCandidatesQuery(PARAMETERS);

		assert.doesNotMatch(sql, /machine\.country = ANY/);
		assert.doesNotMatch(sql, /machine\.continent::text = ANY/);
	});

	it('limits flexible placement to the requested countries and continents', () => {
		const { sql, bindings } = machineCandidatesQuery({
			...PARAMETERS,
			placement: { ...ANYWHERE, locations: LOCATIONS },
		});

		assert.match(
			sql,
			/\(machine\.country = ANY\(ARRAY\[\?\]::varchar\[\]\)\) OR \(machine\.continent::text = ANY\(ARRAY\[\?\]::varchar\[\]\)\)/
		);
		assert.ok(
			bindings.some(
				(binding) =>
					Array.isArray(binding) &&
					binding.length === 1 &&
					binding[0] === COUNTRY
			)
		);
		assert.ok(
			bindings.some(
				(binding) =>
					Array.isArray(binding) &&
					binding.length === 1 &&
					binding[0] === Continent.EUROPE
			)
		);
	});

	it('only binds the kinds of location that were requested', () => {
		const { sql } = machineCandidatesQuery({
			...PARAMETERS,
			placement: { ...ANYWHERE, locations: [COUNTRY_CONSTRAINT] },
		});

		assert.match(sql, /machine\.country = ANY/);
		assert.doesNotMatch(sql, /machine\.continent::text = ANY/);
	});

	it("limits own-machine placement to the customer's machines", () => {
		const own = machineCandidatesQuery({
			...PARAMETERS,
			placement: { ...ANYWHERE, ownMachinesOnly: true },
		});
		const anywhere = machineCandidatesQuery(PARAMETERS);

		assert.equal(placeholders(own.sql) - placeholders(anywhere.sql), 1);
		assert.match(own.sql, /\(machine\."organizationId" = \?\)/);
		assert.doesNotMatch(anywhere.sql, /\(machine\."organizationId" = \?\)/);
	});

	it('selects the machine location for ranking', () => {
		const { sql } = machineCandidatesQuery(PARAMETERS);

		assert.match(sql, /machine\.latitude, machine\.longitude/);
		assert.match(sql, /machine\.country, machine\.continent/);
	});

	it('gates GPUs on the measured machine', () => {
		const { sql, bindings } = machineCandidatesQuery({
			...PARAMETERS,
			gpu: 1,
			gpuType: [GpuType.H100],
		});

		assert.match(sql, /machine\."gpuType" = ANY/);
		assert.match(sql, /fit_load\.gpu \+ \? <= machine\."gpuCount"/);
		assert.ok(bindings.includes(0));
		assert.doesNotMatch(sql, /machine\.gpu\b/);
	});

	it('re-evaluates only the given machines', () => {
		const { sql, bindings } = machineCandidatesQuery(PARAMETERS, [MACHINE_ID]);

		assert.match(sql, /machine\.id = ANY\(ARRAY\[\?\]::uuid\[\]\)/);
		assert.ok(
			bindings.some(
				(binding) => Array.isArray(binding) && binding.includes(MACHINE_ID)
			)
		);
	});

	it('binds exactly one value per placeholder, in every shape', () => {
		for (const params of [
			PARAMETERS,
			{ ...PARAMETERS, snapshotRef: SNAPSHOT_REF, snapshotRequired: true },
			{ ...PARAMETERS, workloadFingerprint: WORKLOAD_FINGERPRINT },
			{ ...PARAMETERS, gpu: 1, gpuType: [] },
			{
				...PARAMETERS,
				placement: {
					...ANYWHERE,
					category: MachineCategory.GPU,
					minimumTier: MachineTier.COMMUNITY,
				},
			},
			{ ...PARAMETERS, placement: { ...ANYWHERE, locations: LOCATIONS } },
			{
				...PARAMETERS,
				placement: {
					...ANYWHERE,
					locations: [COUNTRY_CONSTRAINT],
					ownMachinesOnly: true,
				},
			},
			{
				...PARAMETERS,
				placement: { kind: PlacementKind.PINNED, machineId: MACHINE_ID },
			},
		] satisfies GetMachineParams[]) {
			const { sql, bindings } = machineCandidatesQuery(params);
			assert.equal(placeholders(sql), bindings.length);
		}
	});

	it('gates on the current assessment, slow start and the workload pairing', () => {
		const { sql, bindings } = machineCandidatesQuery({
			...PARAMETERS,
			workloadFingerprint: WORKLOAD_FINGERPRINT,
		});

		assert.match(sql, /assessment\.qualified = true/);
		assert.match(sql, /"qualificationExpiresAt" > transaction_timestamp\(\)/);
		assert.match(sql, /"placementWindow"/);
		assert.ok(bindings.includes(SANDBOX_STATES_CONVERGING));
		assert.ok(bindings.includes(WORKLOAD_FINGERPRINT));
	});
});

describe('exported gate fragments', () => {
	it('binds one value per placeholder', () => {
		for (const fragment of [
			hostGateSql(),
			workloadGateSql({ cpu: 2, memoryGiB: 4, diskGiB: 20, gpu: 0 }),
		]) {
			assert.equal(placeholders(fragment.sql), fragment.bindings.length);
		}
	});
});
