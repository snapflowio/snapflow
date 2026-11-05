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
import { Sandbox } from '../entities/sandbox.entity';
import { SandboxState } from '../enums/sandbox-state.enum';
import { SandboxStateUpdatedEvent } from './sandbox-state-updated.event';

const VOLUME_ID = 'volume-1';
const MOUNT_PATH = '/data';
const CHANGED_MOUNT_PATH = '/elsewhere';
const CPU = 2;
const CHANGED_CPU = 4;

describe('SandboxEvent', () => {
	it('carries plain data captured when it is created', () => {
		const sandbox = Object.assign(new Sandbox({}), {
			organizationId: 'organization-1',
			cpu: CPU,
			volumes: [{ volumeId: VOLUME_ID, mountPath: MOUNT_PATH }],
		});

		const event = new SandboxStateUpdatedEvent(
			sandbox,
			SandboxState.STARTING,
			SandboxState.STARTED
		);
		sandbox.cpu = CHANGED_CPU;
		sandbox.volumes[0].mountPath = CHANGED_MOUNT_PATH;

		assert.equal(event.sandbox instanceof Sandbox, false);
		assert.equal(event.sandbox.id, sandbox.id);
		assert.equal(event.sandbox.cpu, CPU);
		assert.deepEqual(event.sandbox.volumes, [
			{ volumeId: VOLUME_ID, mountPath: MOUNT_PATH },
		]);
	});
});
