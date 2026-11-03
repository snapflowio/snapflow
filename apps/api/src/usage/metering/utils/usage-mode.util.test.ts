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
import { SandboxState } from '../../../sandbox/instance/enums/sandbox-state.enum';
import { UsageMode } from '../constants/usage-lifecycle.constants';
import { usageModeForState } from './usage-mode.util';

const NOT_READY_STATES = [
	SandboxState.CREATING,
	SandboxState.RESTORING,
	SandboxState.STARTING,
	SandboxState.RESUMING,
	SandboxState.PENDING_BUILD,
	SandboxState.BUILDING_SNAPSHOT,
	SandboxState.UNKNOWN,
	SandboxState.ERROR,
	SandboxState.BUILD_FAILED,
] as const;

describe('usageModeForState', () => {
	it('opens no compute window before the runtime is observed started', () => {
		for (const state of NOT_READY_STATES) {
			assert.notEqual(usageModeForState(state), UsageMode.FULL, state);
		}
	});

	it('charges nothing at all for creation, boot and failed starts', () => {
		for (const state of NOT_READY_STATES) {
			assert.equal(usageModeForState(state), null, state);
		}
	});

	it('meters every resource only once the runtime is started', () => {
		assert.equal(usageModeForState(SandboxState.STARTED), UsageMode.FULL);
	});
});
