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
import { fakeInstance } from '../../../common/testing/instance.fake';
import { Machine } from '../../../machine/entities/machine.entity';
import {
	EXPOSURE_BACKEND_STATE,
	EXPOSURE_TARGET_HOST,
} from '../../constants/exposure.constants';
import {
	MACHINE_EDGE_BINDING_DESIRED_STATE,
	MACHINE_EDGE_BINDING_STATE,
} from '../../constants/machine-tunnel.constants';
import { NETWORK_PROTOCOL } from '../../constants/networking.constants';
import { Exposure } from '../../entities/exposure.entity';
import { ExposureBackend } from '../../entities/exposure-backend.entity';
import { MachineEdgeBinding } from '../../entities/machine-edge-binding.entity';
import {
	machineBindingDigest,
	machineTargetPlanDigest,
} from '../../utils/machine-tunnel/machine-binding-digest.util';
import { machineTunnelTargetDto } from '../../utils/machine-tunnel/machine-tunnel-target.util';
import { MachineBindingTargetService } from './machine-binding-target.service';
import { MachineEdgeBindingFenceService } from './machine-edge-binding-fence.service';

const MACHINE_ID = '6f708192-a3b4-4fc0-9142-5d6e7f8091a2';
const EDGE_ID = '708192a3-b4c5-40d1-a253-6e7f8091a2b3';
const BINDING_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const BACKEND_ID = '3c4d5e6f-7081-4c9d-8e1f-2a3b4c5d6e7f';
const EXPOSURE_ID = '4d5e6f70-8192-4dae-9f20-3b4c5d6e7f80';
const SESSION_GENERATION = 4;
const BINDING_REVISION = 2;
const TARGET_REVISION = 5;
const TARGET_PORT = 8_080;
const BACKENDS_ARGUMENT = 1;
type TargetDtosCall = Parameters<MachineBindingTargetService['targetDtos']>;
const ACKNOWLEDGED_AT = new Date('2026-10-04T05:30:15.000Z');
const LEASE_EXPIRES_AT = new Date('2026-10-04T05:35:15.000Z');

const machine = Object.assign(new Machine(), {
	id: MACHINE_ID,
	sessionGeneration: SESSION_GENERATION,
});

const exposure = Object.assign(new Exposure(), {
	id: EXPOSURE_ID,
	systemService: null,
	targetHost: EXPOSURE_TARGET_HOST.RUNTIME,
	targetReference: null,
});

function backend(): ExposureBackend {
	return Object.assign(new ExposureBackend(), {
		id: BACKEND_ID,
		bindingId: BINDING_ID,
		exposureId: EXPOSURE_ID,
		exposureGeneration: 1,
		sandboxId: 'sandbox',
		assignmentGeneration: 1,
		placementFencingTokenHash: 'e'.repeat(64),
		protocol: NETWORK_PROTOCOL.HTTP,
		targetPort: TARGET_PORT,
		state: EXPOSURE_BACKEND_STATE.PENDING,
		leaseExpiresAt: LEASE_EXPIRES_AT,
		machineAcknowledgedAt: ACKNOWLEDGED_AT,
	});
}

function currentBinding(target: ExposureBackend): MachineEdgeBinding {
	const digest = machineBindingDigest(
		MACHINE_ID,
		EDGE_ID,
		SESSION_GENERATION,
		BINDING_REVISION
	);
	const targetDigest = machineTargetPlanDigest(
		BINDING_ID,
		BINDING_REVISION,
		TARGET_REVISION,
		[machineTunnelTargetDto(target, exposure)]
	);
	target.bindingRevision = BINDING_REVISION;
	target.bindingDigest = digest;
	target.targetRevision = TARGET_REVISION;
	target.targetDigest = targetDigest;
	return Object.assign(new MachineEdgeBinding(), {
		id: BINDING_ID,
		machineId: MACHINE_ID,
		edgeId: EDGE_ID,
		machineSessionGeneration: SESSION_GENERATION,
		desiredState: MACHINE_EDGE_BINDING_DESIRED_STATE.ACTIVE,
		observedState: MACHINE_EDGE_BINDING_STATE.ACTIVE,
		revision: BINDING_REVISION,
		digest,
		targetRevision: TARGET_REVISION,
		targetDigest,
	});
}

function fenceService(): MachineEdgeBindingFenceService {
	const targets = fakeInstance(MachineBindingTargetService, {
		targetDtos: async (...call: TargetDtosCall) =>
			call[BACKENDS_ARGUMENT].map((item) =>
				machineTunnelTargetDto(item, exposure)
			),
	});
	return new MachineEdgeBindingFenceService(targets);
}

const manager = fakeInstance(EntityManager);

describe('MachineEdgeBindingFenceService.fence', () => {
	it('keeps the machine acknowledgement when the target plan digest is unchanged', async () => {
		const target = backend();
		const binding = currentBinding(target);
		await fenceService().fence(manager, exposure, machine, binding, true, [
			target,
		]);
		assert.equal(binding.targetRevision, TARGET_REVISION);
		assert.equal(target.machineAcknowledgedAt, ACKNOWLEDGED_AT);
	});

	it('clears the machine acknowledgement when the target plan digest changes', async () => {
		const target = backend();
		const binding = currentBinding(target);
		target.targetPort += 1;
		await fenceService().fence(manager, exposure, machine, binding, true, [
			target,
		]);
		assert.equal(binding.targetRevision, TARGET_REVISION + 1);
		assert.equal(target.targetDigest, binding.targetDigest);
		assert.equal(target.machineAcknowledgedAt, null);
	});
});
