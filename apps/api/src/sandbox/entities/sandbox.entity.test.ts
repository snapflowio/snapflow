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
import { SandboxDesiredState } from '../enums/sandbox-desired-state.enum';
import { SandboxState } from '../enums/sandbox-state.enum';
import { Sandbox } from './sandbox.entity';

function sandbox(state: SandboxState, desiredState: SandboxDesiredState) {
	return Object.assign(new Sandbox({}), {
		state,
		desiredState,
	});
}

describe('Sandbox state behaviour', () => {
	it('rests in the state matching a started or stopped desired state only', () => {
		assert.equal(
			sandbox(SandboxState.FORKING, SandboxDesiredState.STARTED).restingState(),
			SandboxState.STARTED
		);
		assert.equal(
			sandbox(SandboxState.FORKING, SandboxDesiredState.STOPPED).restingState(),
			SandboxState.STOPPED
		);
		for (const desiredState of [
			SandboxDesiredState.ARCHIVED,
			SandboxDesiredState.DESTROYED,
			SandboxDesiredState.PAUSED,
			SandboxDesiredState.RESIZED,
		]) {
			assert.equal(
				sandbox(SandboxState.FORKING, desiredState).restingState(),
				null
			);
		}
	});

	it('treats error and failed builds as errored', () => {
		assert.ok(
			sandbox(SandboxState.ERROR, SandboxDesiredState.STARTED).isErrored()
		);
		assert.ok(
			sandbox(
				SandboxState.BUILD_FAILED,
				SandboxDesiredState.STARTED
			).isErrored()
		);
		assert.ok(
			!sandbox(SandboxState.STARTED, SandboxDesiredState.STARTED).isErrored()
		);
	});

	it('ends state synchronization in terminal states and unrecoverable errors', () => {
		for (const state of [
			SandboxState.DESTROYED,
			SandboxState.BUILD_FAILED,
			SandboxState.RESIZING,
			SandboxState.SNAPSHOTTING,
			SandboxState.FORKING,
		]) {
			assert.ok(
				sandbox(
					state,
					SandboxDesiredState.STARTED
				).isStateSynchronizationTerminal()
			);
		}
		assert.ok(
			sandbox(
				SandboxState.ERROR,
				SandboxDesiredState.STARTED
			).isStateSynchronizationTerminal()
		);
		assert.ok(
			!sandbox(
				SandboxState.ERROR,
				SandboxDesiredState.DESTROYED
			).isStateSynchronizationTerminal()
		);
		assert.ok(
			!sandbox(
				SandboxState.STARTING,
				SandboxDesiredState.STARTED
			).isStateSynchronizationTerminal()
		);
	});
});
