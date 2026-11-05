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
import { SandboxDesiredState } from '../../enums/sandbox-desired-state.enum';
import { SandboxState } from '../../enums/sandbox-state.enum';
import { sandboxDesiredStateAcceptsState } from './sandbox-state-validation.util';

describe('sandboxDesiredStateAcceptsState', () => {
	it('accepts lifecycle transitions that converge toward the desired state', () => {
		assert.equal(
			sandboxDesiredStateAcceptsState(
				SandboxDesiredState.STARTED,
				SandboxState.CREATING
			),
			true
		);
		assert.equal(
			sandboxDesiredStateAcceptsState(
				SandboxDesiredState.PAUSED,
				SandboxState.PAUSING
			),
			true
		);
	});

	it('rejects states that contradict the desired lifecycle', () => {
		assert.equal(
			sandboxDesiredStateAcceptsState(
				SandboxDesiredState.STOPPED,
				SandboxState.CREATING
			),
			false
		);
		assert.equal(
			sandboxDesiredStateAcceptsState(
				SandboxDesiredState.PAUSED,
				SandboxState.DESTROYED
			),
			false
		);
	});
});
