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
import { SandboxState } from '../../instance/enums/sandbox-state.enum';
import { placementMachineId } from './placement-assignment.util';

const MACHINE_ID = '00000000-0000-4000-8000-000000000001';

describe('placementMachineId', () => {
	it('keeps the placement of a sandbox that holds a runtime', () => {
		for (const state of [
			SandboxState.STARTED,
			SandboxState.STOPPED,
			SandboxState.CREATING,
		]) {
			assert.equal(
				placementMachineId({ machineId: MACHINE_ID, state }),
				MACHINE_ID
			);
		}
	});

	it('releases the placement and billing hold of runtime-less states', () => {
		for (const state of [
			SandboxState.ARCHIVED,
			SandboxState.DESTROYED,
			SandboxState.BUILD_FAILED,
		]) {
			assert.equal(placementMachineId({ machineId: MACHINE_ID, state }), null);
		}
	});

	it('has no placement without a machine', () => {
		assert.equal(
			placementMachineId({ machineId: null, state: SandboxState.STARTED }),
			null
		);
	});
});
