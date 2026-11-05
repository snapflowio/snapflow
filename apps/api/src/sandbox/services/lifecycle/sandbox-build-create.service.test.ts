/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { EntityManager } from '@mikro-orm/postgresql';
import { fakeInstance, fakeValue } from '../../../common/testing/instance.fake';
import type { HumanPrincipal } from '../../../common/types/platform-principal.types';
import { RedisLockProvider } from '../../../infra/redis/providers/redis-lock.provider';
import { GeoIpService } from '../../../location/services/geo-ip.service';
import { Machine } from '../../../machine/entities/machine.entity';
import { PlacementKind } from '../../../marketplace/enums/placement-kind.enum';
import { Organization } from '../../../organization/entities/organization.entity';
import { OrganizationLimits } from '../../../organization/entities/organization-limits.entity';
import { OrganizationService } from '../../../organization/services/organization.service';
import { OrganizationLimitsService } from '../../../organization/services/organization-limits.service';
import { OrganizationQuotaService } from '../../../organization/services/organization-quota.service';
import { NoAvailableMachineError } from '../../../placement/exceptions/no-available-machine.exception';
import {
	MachineReservationService,
	type ReservedMachine,
} from '../../../placement/services/machine-reservation.service';
import { MachineSchedulingService } from '../../../placement/services/machine-scheduling.service';
import { SandboxPlacementResolverService } from '../../../placement/services/sandbox-placement-resolver.service';
import { SecretService } from '../../../secrets/services/secret.service';
import { fakeSettings } from '../../../settings/testing/settings.fake';
import { VolumeService } from '../../../volume/services/volume.service';
import { CreateSandboxDto } from '../../dto/create-sandbox.dto';
import type { Sandbox } from '../../entities/sandbox.entity';
import { PlacementLocality } from '../../enums/placement-locality.enum';
import { SandboxMode } from '../../enums/sandbox-mode.enum';
import { SandboxState } from '../../enums/sandbox-state.enum';
import {
	type ReservedInsert,
	SandboxRepository,
} from '../../repositories/sandbox.repository';
import { SandboxAdmissionService } from '../admission/sandbox-admission.service';
import { SandboxService } from '../sandbox/sandbox.service';
import { SandboxQuotaService } from '../sandbox/sandbox-quota.service';
import { SandboxBuildCreateService } from './sandbox-build-create.service';
import { SandboxCreateNotifier } from './sandbox-create-notifier.service';

const ORGANIZATION_ID = '2b000000-0000-4000-8000-000000000001';
const MACHINE_ID = '1a000000-0000-4000-8000-000000000001';
const UNSERVED_COUNTRY = 'JP';
const DOCKERFILE = 'FROM python:3.12-slim\nRUN echo built > /built.txt';

async function reserveMachineWithoutBuild(
	...reservation: Parameters<MachineReservationService['reserve']>
): Promise<ReservedMachine> {
	const params = reservation[1];
	if (params.snapshotRef !== undefined && params.snapshotRequired) {
		throw new NoAvailableMachineError();
	}
	return {
		machine: fakeInstance(Machine, { id: MACHINE_ID }),
		locality: PlacementLocality.REMOTE,
	};
}

function subject(placementCanEverBeMet = true) {
	const scheduling = fakeInstance(MachineSchedulingService, {
		placementCanEverBeMet: async () => placementCanEverBeMet,
	});
	const reservations = fakeInstance(MachineReservationService);
	const reserve = mock.method(
		reservations,
		'reserve',
		reserveMachineWithoutBuild
	);
	const repository = fakeInstance(SandboxRepository);
	mock.method(
		repository,
		'insertWithMachineReservation',
		async (sandbox: Sandbox, { reserveMachine }: ReservedInsert) => {
			sandbox.machineId = (
				await reserveMachine(fakeInstance(EntityManager))
			).machine.id;
			return sandbox;
		}
	);
	const insert = mock.method(
		repository,
		'insert',
		async (sandbox: Sandbox) => sandbox
	);
	const geoIp = fakeInstance(GeoIpService, { locate: () => null });
	const organizations = fakeInstance(OrganizationService);
	mock.method(organizations, 'findOneOrFail', async () =>
		fakeInstance(Organization, {
			id: ORGANIZATION_ID,
			suspended: false,
			suspendedUntil: null,
		})
	);
	const organizationLimits = fakeInstance(OrganizationLimitsService);
	mock.method(organizationLimits, 'get', async () =>
		fakeInstance(OrganizationLimits, {
			organizationId: ORGANIZATION_ID,
			sandboxLimitedNetworkEgress: false,
		})
	);
	const quota = fakeInstance(SandboxQuotaService);
	mock.method(quota, 'validateOrganizationQuotas', async () => ({
		pendingCpuIncremented: false,
		pendingMemoryIncremented: false,
		pendingDiskIncremented: false,
		pendingGpuIncremented: false,
	}));
	const entityManager = fakeInstance(EntityManager, {
		getRepository: () => ({
			findOne: async () => null,
			create: (data: object) => data,
		}),
		persist: () => undefined,
	});
	const admission = new SandboxAdmissionService(
		fakeInstance(SandboxService),
		entityManager,
		fakeInstance(VolumeService),
		fakeSettings()
	);
	const service = new SandboxBuildCreateService(
		entityManager,
		admission,
		new SandboxPlacementResolverService(fakeInstance(EntityManager), geoIp),
		repository,
		reservations,
		scheduling,
		quota,
		organizationLimits,
		fakeInstance(OrganizationQuotaService, { find: async () => null }),
		organizations,
		fakeInstance(RedisLockProvider),
		fakeInstance(SecretService),
		fakeInstance(SandboxCreateNotifier, { notifyCreated: () => undefined })
	);
	return { service, reserve, insert };
}

describe('SandboxBuildCreateService.create', () => {
	it('waits for the build instead of placing the sandbox on a Machine without it', async () => {
		const { service, reserve, insert } = subject();

		await service.create(
			fakeInstance(CreateSandboxDto, {
				mode: SandboxMode.EPHEMERAL,
				buildInfo: { dockerfileContent: DOCKERFILE, contextHashes: [] },
			}),
			ORGANIZATION_ID,
			fakeValue<HumanPrincipal>({}),
			false
		);

		const parameters = reserve.mock.calls[0]?.arguments[1];
		const created = insert.mock.calls[0]?.arguments[0];
		assert.equal(insert.mock.callCount(), 1);
		assert.equal(parameters?.snapshotRef, created?.buildInfo?.snapshotRef);
		assert.equal(parameters?.snapshotRequired, true);
		assert.equal(created?.state, SandboxState.PENDING_BUILD);
		assert.equal(created?.machineId, null);
		assert.equal(created?.runtimeSpec, null);
	});

	it('refuses a build that no machine in the requested locations could ever host', async () => {
		const { service, insert } = subject(false);

		await assert.rejects(
			service.create(
				fakeInstance(CreateSandboxDto, {
					mode: SandboxMode.EPHEMERAL,
					buildInfo: { dockerfileContent: DOCKERFILE, contextHashes: [] },
					placement: {
						kind: PlacementKind.FLEXIBLE,
						locations: [UNSERVED_COUNTRY],
					},
				}),
				ORGANIZATION_ID,
				fakeValue<HumanPrincipal>({}),
				false
			),
			NoAvailableMachineError
		);
		assert.equal(insert.mock.callCount(), 0);
	});
});
