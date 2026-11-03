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
import { after, before, describe, it, mock } from 'node:test';
import { DeadlockException } from '@mikro-orm/core';
import { type EntityManager, MikroORM } from '@mikro-orm/postgresql';
import { MACHINE_TRUST_POLICY } from '../../../billing/ledger/constants/machine-trust.constants';
import { PlacementBillingCapacityService } from '../../../billing/ledger/services/placement/placement-billing-capacity.service';
import { fakeInstance } from '../../../common/testing/instance.fake';
import { integrationDatabaseUrl } from '../../../common/testing/integration-database.util';
import { ENTITY_MAPPING_OPTIONS } from '../../../infra/database/config/entity-mapping.config';
import { NO_KEY_UPDATE_LOCK } from '../../../infra/database/utils/row-lock.util';
import { Continent } from '../../../location/enums/continent.enum';
import { LocationConstraintKind } from '../../../location/enums/location-constraint-kind.enum';
import { MachineListing } from '../../../marketplace/machine/entities/machine-listing.entity';
import { MachinePriceCard } from '../../../marketplace/machine/entities/machine-price-card.entity';
import { ListingState } from '../../../marketplace/machine/enums/listing-state.enum';
import { ListingVisibility } from '../../../marketplace/machine/enums/listing-visibility.enum';
import { PlacementKind } from '../../../marketplace/machine/enums/placement-kind.enum';
import { Organization } from '../../../organization/tenant/entities/organization.entity';
import { fakeSettings } from '../../../settings/platform/testing/settings.fake';
import { User } from '../../../user/entities/user.entity';
import { MachineBenchmark } from '../../../verification/qualification/entities/machine-benchmark.entity';
import { SandboxClass } from '../../instance/enums/sandbox-class.enum';
import { MACHINE_QUALIFICATION_POLICY } from '../../machine/constants/machine-qualification.constants';
import { Machine } from '../../machine/entities/machine.entity';
import { MachineAssessment } from '../../machine/entities/machine-assessment.entity';
import { MachineState } from '../../machine/enums/machine-state.enum';
import type {
	CustomerMachineParams,
	FlexiblePlacement,
} from '../../machine/types/machine-scheduling.types';
import { lockMachinesForUpdate } from '../../machine/utils/machine-lock.util';
import { SnapshotMachine } from '../../snapshot/entities/snapshot-machine.entity';
import { SnapshotMachineState } from '../../snapshot/enums/snapshot-machine-state.enum';
import { MachineAvailabilityService } from './machine-availability.service';
import { MachineReservationService } from './machine-reservation.service';
import { MachineSchedulingService } from './machine-scheduling.service';
import { PlacementQuoteService } from './placement-quote.service';

const DATABASE_URL = integrationDatabaseUrl();
const ITERATIONS = 30;
const LIFETIME_MILLISECONDS = 60 * 60 * 1_000;
const MACHINE_CPU = 64;
const MACHINE_MEMORY_GIB = 256;
const MACHINE_DISK_GIB = 1_024;
const RELIABILITY_BASIS_POINTS = 9_000;
const RACE_WINDOW_SECONDS = 0.02;
const LOCK_NOT_AVAILABLE = '55P03';
const MACHINE_COUNTRY = 'DE';
const ELSEWHERE_COUNTRY = 'FR';
const OWN_MACHINES: FlexiblePlacement = {
	kind: PlacementKind.FLEXIBLE,
	locations: [],
	ownMachinesOnly: true,
	origin: null,
};

describe('machine reservations under concurrency', {
	skip: DATABASE_URL ? false : 'DATABASE_URL is not configured',
}, () => {
	let orm: MikroORM;
	const organizationId = randomUUID();
	const machines = [machine(), machine()].sort((left, right) =>
		left.id < right.id ? -1 : 1
	);
	const [lower, higher] = machines;

	before(async () => {
		orm = await MikroORM.init({
			...ENTITY_MAPPING_OPTIONS,
			clientUrl: DATABASE_URL,
			entities: [
				Organization,
				User,
				Machine,
				MachineAssessment,
				SnapshotMachine,
				MachineListing,
				MachinePriceCard,
				MachineBenchmark,
			],
		});
		const manager = orm.em.fork();
		manager.create(
			Organization,
			{ id: organizationId, name: organizationId, slug: organizationId },
			{ partial: true }
		);
		await manager.flush();
		const now = new Date();
		for (const seeded of machines) {
			seeded.state = MachineState.READY;
			seeded.sessionExpiresAt = new Date(now.getTime() + LIFETIME_MILLISECONDS);
		}
		manager.persist(machines);
		await manager.flush();
		manager.persist(machines.map(({ id }) => assessment(manager, id)));
		await manager.flush();
		for (const { id } of machines) {
			await manager.execute(
				'INSERT INTO machine_listing ("machineId", state, visibility) VALUES (?, ?, ?)',
				[id, ListingState.LISTED, ListingVisibility.PRIVATE]
			);
		}
	});

	after(async () => {
		if (!orm) return;
		const manager = orm.em.fork();
		const machineIds = machines.map(({ id }) => id);
		await manager.execute(
			'DELETE FROM machine_listing WHERE "machineId" = ANY(ARRAY[?]::uuid[])',
			[machineIds]
		);
		await manager.nativeDelete(Machine, { id: { $in: machineIds } });
		await manager.nativeDelete(Organization, { id: organizationId });
		await orm.close(true);
	});

	it('never deadlocks opposite moves between the same Machines', async () => {
		const failures: unknown[] = [];
		for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
			const outcomes = await Promise.allSettled([
				move(lower.id, higher.id),
				move(higher.id, lower.id),
			]);
			for (const outcome of outcomes) {
				if (outcome.status === 'rejected') failures.push(outcome.reason);
			}
		}

		assert.deepEqual(
			failures.filter((failure) => failure instanceof DeadlockException),
			[]
		);
		assert.deepEqual(failures, []);
	});

	it('releases a rejected candidate and the Machines locked with it', async () => {
		await orm.em.fork().transactional(async (manager) => {
			const rejected = await reservations().reserveSpecific(
				manager,
				lower.id,
				{
					...workload(),
					placement: {
						...OWN_MACHINES,
						locations: [
							{
								kind: LocationConstraintKind.COUNTRY,
								country: ELSEWHERE_COUNTRY,
							},
						],
					},
				},
				[higher.id]
			);

			assert.equal(rejected, null);
			assert.deepEqual(await lockableElsewhere(machines), [true, true]);
		});
	});

	it('keeps the reserved Machine and the Machines locked with it', async () => {
		await orm.em.fork().transactional(async (manager) => {
			const reserved = await reservations().reserveSpecific(
				manager,
				lower.id,
				workload(),
				[higher.id]
			);

			assert.equal(reserved?.machine.id, lower.id);
			assert.deepEqual(await lockableElsewhere(machines), [false, false]);
		});
	});

	it('places a required snapshot on the Machine that holds it', async () => {
		const snapshotRef = `snapflow-${randomUUID()}:snapflow`;
		const manager = orm.em.fork();
		await manager.execute(
			'INSERT INTO snapshot_machine ("machineId", "snapshotRef", state, "observedAt") VALUES (?, ?, ?, now())',
			[higher.id, snapshotRef, SnapshotMachineState.PRESENT]
		);
		try {
			const holder = await new MachineSchedulingService(
				orm.em.fork(),
				fakeSettings()
			).findBestMachine({
				...workload(),
				snapshotRef,
				snapshotRequired: true,
			});

			assert.equal(holder?.id, higher.id);
		} finally {
			await manager.execute(
				'DELETE FROM snapshot_machine WHERE "snapshotRef" = ?',
				[snapshotRef]
			);
		}
	});

	async function move(fromMachineId: string, toMachineId: string) {
		await orm.em.fork().transactional(async (manager) => {
			const reserved = await reservations().reserveAvailable(
				manager,
				{ ...workload(), excludedMachineIds: [fromMachineId] },
				[fromMachineId]
			);
			assert.equal(reserved.machine.id, toMachineId);
			await manager.execute('SELECT pg_sleep(?)', [RACE_WINDOW_SECONDS]);
			await lockMachinesForUpdate(manager, [
				reserved.machine.id,
				fromMachineId,
			]);
		});
	}

	async function lockableElsewhere(
		lockable: readonly Machine[]
	): Promise<boolean[]> {
		const results: boolean[] = [];
		for (const { id } of lockable) {
			results.push(await lockableNow(id));
		}
		return results;
	}

	async function lockableNow(machineId: string): Promise<boolean> {
		try {
			await orm.em
				.fork()
				.transactional((manager) =>
					manager.execute(
						`SELECT 1 FROM machine WHERE id = ? ${NO_KEY_UPDATE_LOCK} NOWAIT`,
						[machineId]
					)
				);
			return true;
		} catch (error) {
			if (
				typeof error === 'object' &&
				error !== null &&
				'code' in error &&
				error.code === LOCK_NOT_AVAILABLE
			) {
				return false;
			}
			throw error;
		}
	}

	function workload(): CustomerMachineParams {
		return {
			customerOrganizationId: organizationId,
			placement: OWN_MACHINES,
			sandboxClass: SandboxClass.LINUX_VM,
			gpu: 0,
			gpuType: null,
			cpu: 1,
			memoryGiB: 1,
			diskGiB: 1,
		};
	}

	function reservations(): MachineReservationService {
		const capacity = fakeInstance(PlacementBillingCapacityService);
		mock.method(capacity, 'admit', async (...args: unknown[]) => ({
			admitted: Array.isArray(args[2]) ? [...args[2]] : [],
			restriction: null,
		}));
		mock.method(capacity, 'assertAdmissible', async () => undefined);
		return new MachineReservationService(
			new MachineSchedulingService(orm.em, fakeSettings()),
			capacity,
			fakeInstance(MachineAvailabilityService),
			fakeInstance(PlacementQuoteService)
		);
	}

	function machine(): Machine {
		const created = new Machine({
			name: `reservation-${randomUUID()}`,
			apiVersion: '1',
			organizationId,
			cpu: MACHINE_CPU,
			memoryGiB: MACHINE_MEMORY_GIB,
			diskGiB: MACHINE_DISK_GIB,
		});
		created.country = MACHINE_COUNTRY;
		created.continent = Continent.EUROPE;
		return created;
	}
});

function assessment(
	manager: EntityManager,
	machineId: string
): MachineAssessment {
	const now = new Date();
	return manager.create(
		MachineAssessment,
		{
			machineId,
			qualified: true,
			reliabilityBasisPoints: RELIABILITY_BASIS_POINTS,
			qualificationExpiresAt: new Date(now.getTime() + LIFETIME_MILLISECONDS),
			qualificationPolicyVersion: MACHINE_QUALIFICATION_POLICY.VERSION,
			policyVersion: MACHINE_TRUST_POLICY.version,
			assessedAt: now,
		},
		{ partial: true }
	);
}
