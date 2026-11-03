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
import { ConflictException } from '@nestjs/common';
import { PlacementBillingAuthorizationService } from '../../../../billing/ledger/services/placement/placement-billing-authorization.service';
import { fakeInstance } from '../../../../common/testing/instance.fake';
import { Sandbox } from '../../../../sandbox/instance/entities/sandbox.entity';
import { SandboxState } from '../../../../sandbox/instance/enums/sandbox-state.enum';
import { SandboxService } from '../../../../sandbox/instance/services/sandbox/sandbox.service';
import {
	EXPOSURE_DESIRED_STATE,
	EXPOSURE_KIND,
	SYSTEM_EXPOSURE_LEASE,
	SYSTEM_EXPOSURE_SERVICE,
	type SystemExposureService,
} from '../../constants/exposure.constants';
import { Exposure } from '../../entities/exposure.entity';
import { ExposureReconciliationQueueService } from './exposure-reconciliation-queue.service';
import { SystemExposureLeaseService } from './system-exposure-lease.service';

const UUID_ID_PROPERTIES = { id: { columnTypes: ['uuid'] } };

const ORGANIZATION_ID = '7f9c2a4e-5b1d-4c3a-9e8f-1a2b3c4d5e6f';
const SANDBOX_ID = 'sandbox-1';
const EXPOSURE_ID = '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d';
const SNAPSHOT_REFERENCE = 'registry.snapflow.test/builds/sandbox-1:failed';
const EXPOSURE_TABLE = 'sandbox_exposure';

function failedBuildSandbox(): Sandbox {
	return Object.assign(new Sandbox(), {
		id: SANDBOX_ID,
		organizationId: ORGANIZATION_ID,
		state: SandboxState.BUILD_FAILED,
		buildInfo: { snapshotRef: SNAPSHOT_REFERENCE },
	});
}

function disabledSystemExposure(service: SystemExposureService): Exposure {
	return Object.assign(new Exposure(), {
		id: EXPOSURE_ID,
		organizationId: ORGANIZATION_ID,
		sandboxId: SANDBOX_ID,
		kind: EXPOSURE_KIND.SYSTEM,
		systemService: service,
		desiredState: EXPOSURE_DESIRED_STATE.DISABLED,
		targetReference: null,
		systemRequestedUntil: null,
		generation: 1,
		createdAt: new Date(),
		updatedAt: new Date(),
	});
}

class ReleasedPlacementManager {
	readonly exposure: Exposure;

	constructor(service: SystemExposureService) {
		this.exposure = disabledSystemExposure(service);
	}

	async findOne(entity: unknown): Promise<Sandbox | Exposure | null> {
		if (entity === Sandbox) return failedBuildSandbox();
		return null;
	}

	async find(entity: unknown): Promise<Exposure[]> {
		assert.equal(entity, Exposure);
		return [this.exposure];
	}

	getMetadata() {
		return {
			tableName: EXPOSURE_TABLE,
			primaryKeys: ['id'],
			properties: UUID_ID_PROPERTIES,
		};
	}

	getPlatform(): { quoteIdentifier: (name: string) => string } {
		return { quoteIdentifier: (name) => `"${name}"` };
	}

	async execute(): Promise<{ now: Date }[]> {
		return [{ now: new Date() }];
	}

	private readonly entityManager = fakeInstance(EntityManager, {
		findOne: this.findOne.bind(this),
		find: this.find.bind(this),
		getMetadata: this.getMetadata.bind(this),
		getPlatform: this.getPlatform.bind(this),
		execute: this.execute.bind(this),
	});

	asEntityManager(): EntityManager {
		return this.entityManager;
	}
}

function leaseService() {
	const enqueued: {
		manager: EntityManager;
		exposureId: string;
		generation: number;
	}[] = [];
	let billingRenewals = 0;
	const sandboxes = fakeInstance(SandboxService, {
		findOneByIdOrName: async () => failedBuildSandbox(),
	});
	const billing = fakeInstance(PlacementBillingAuthorizationService, {
		renewForSandbox: async () => {
			billingRenewals += 1;
			throw new ConflictException('Sandbox has no active placement');
		},
	});
	const queue = fakeInstance(ExposureReconciliationQueueService, {
		enqueue: async (
			manager: EntityManager,
			exposureId: string,
			generation: number
		) => {
			enqueued.push({ manager, exposureId, generation });
		},
	});
	return {
		leases: new SystemExposureLeaseService(
			fakeInstance(EntityManager),
			sandboxes,
			billing,
			queue
		),
		enqueued,
		billingRenewals: () => billingRenewals,
	};
}

describe('SystemExposureLeaseService for a failed build', () => {
	it('activates build logs without a runtime placement or billing renewal', async () => {
		const { leases, enqueued, billingRenewals } = leaseService();
		const manager = new ReleasedPlacementManager(
			SYSTEM_EXPOSURE_SERVICE.BUILD_LOGS
		);

		const exposure = await leases.request(
			ORGANIZATION_ID,
			SANDBOX_ID,
			SYSTEM_EXPOSURE_SERVICE.BUILD_LOGS,
			SYSTEM_EXPOSURE_LEASE.defaultDurationSeconds,
			manager.asEntityManager()
		);

		assert.equal(exposure.id, EXPOSURE_ID);
		assert.equal(billingRenewals(), 0);
		assert.equal(manager.exposure.desiredState, EXPOSURE_DESIRED_STATE.ACTIVE);
		assert.equal(manager.exposure.targetReference, SNAPSHOT_REFERENCE);
		assert.deepEqual(enqueued, [
			{
				manager: manager.asEntityManager(),
				exposureId: EXPOSURE_ID,
				generation: 2,
			},
		]);
	});

	it('still requires a billed runtime placement for runtime services', async () => {
		const { leases, enqueued, billingRenewals } = leaseService();
		const manager = new ReleasedPlacementManager(
			SYSTEM_EXPOSURE_SERVICE.TOOLBOX
		);

		await assert.rejects(
			leases.request(
				ORGANIZATION_ID,
				SANDBOX_ID,
				SYSTEM_EXPOSURE_SERVICE.TOOLBOX,
				SYSTEM_EXPOSURE_LEASE.defaultDurationSeconds,
				manager.asEntityManager()
			),
			ConflictException
		);
		assert.equal(billingRenewals(), 1);
		assert.deepEqual(enqueued, []);
	});
});
