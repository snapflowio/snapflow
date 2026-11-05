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
import { BadRequestException, HttpStatus } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { fakeInstance } from '../../../common/testing/instance.fake';
import { DockerRegistryService } from '../../../docker-registry/services/docker-registry.service';
import { OrganizationService } from '../../../organization/services/organization.service';
import { Sandbox } from '../../entities/sandbox.entity';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { MachineService } from '../../machine/services/machine.service';
import { MachineJobDispatchService } from '../../machine-job/services/machine-job-dispatch.service';
import { SandboxRepository } from '../../repositories/sandbox.repository';
import { SnapshotQuotaService } from '../../snapshot/services/snapshot-quota.service';
import { SandboxService } from '../sandbox/sandbox.service';
import { SandboxCaptureService } from './sandbox-capture.service';

const ORGANIZATION_ID = '7f9c2a4e-5b1d-4c3a-9e8f-1a2b3c4d5e6f';
const SANDBOX_ID = '1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d';

function capture(state: SandboxState) {
	const sandboxes = fakeInstance(SandboxService);
	mock.method(sandboxes, 'findOneByIdOrName', async () =>
		Object.assign(new Sandbox({}), {
			id: SANDBOX_ID,
			organizationId: ORGANIZATION_ID,
			state,
		})
	);
	const quota = fakeInstance(SnapshotQuotaService);
	const reserve = mock.method(quota, 'reserve', async () => undefined);
	mock.method(quota, 'release', async () => undefined);
	const repository = fakeInstance(SandboxRepository);
	const transition = mock.method(repository, 'updateWhere', async () =>
		fakeInstance(Sandbox)
	);
	const service = new SandboxCaptureService(
		fakeInstance(EntityManager),
		sandboxes,
		repository,
		fakeInstance(MachineService),
		fakeInstance(MachineJobDispatchService),
		fakeInstance(OrganizationService),
		fakeInstance(DockerRegistryService),
		quota,
		fakeInstance(EventEmitter2)
	);
	return { service, reserve, transition };
}

describe('SandboxCaptureService.createSnapshotFromSandbox', () => {
	it('answers a running sandbox with a 400 before reserving quota or changing state', async () => {
		const { service, reserve, transition } = capture(SandboxState.STARTED);

		await assert.rejects(
			service.createSnapshotFromSandbox(SANDBOX_ID, ORGANIZATION_ID, {
				name: 'captured',
			}),
			(error: unknown) => {
				assert.ok(error instanceof BadRequestException);
				assert.equal(error.getStatus(), HttpStatus.BAD_REQUEST);
				return true;
			}
		);
		assert.equal(reserve.mock.callCount(), 0);
		assert.equal(transition.mock.callCount(), 0);
	});
});
