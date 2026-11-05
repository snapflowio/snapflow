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
import { LeaseEndReason } from '../../../marketplace/enums/lease-end-reason.enum';
import { SandboxState } from '../../enums/sandbox-state.enum';
import {
	leaseEndReason,
	placementReleaseReason,
} from './placement-release.util';

const FIRST = 'machine-a';
const SECOND = 'machine-b';

function endedWith(
	state: SandboxState,
	assignedMachineId: string | null
): LeaseEndReason {
	return leaseEndReason(
		placementReleaseReason(state, FIRST, assignedMachineId)
	);
}

describe('lease end reasons', () => {
	it('ends the lease of an archived sandbox as archived', () => {
		assert.equal(
			endedWith(SandboxState.ARCHIVED, null),
			LeaseEndReason.ARCHIVED
		);
	});

	it('ends the lease of a destroyed sandbox as destroyed', () => {
		assert.equal(
			endedWith(SandboxState.DESTROYED, null),
			LeaseEndReason.DESTROYED
		);
	});

	it('ends the lease of a resized sandbox on the same machine as resized', () => {
		assert.equal(
			endedWith(SandboxState.STOPPED, FIRST),
			LeaseEndReason.RESIZED
		);
	});

	it('ends the lease of a sandbox placed elsewhere as reassigned', () => {
		assert.equal(
			endedWith(SandboxState.RESTORING, SECOND),
			LeaseEndReason.REASSIGNED
		);
	});

	it('releases the lease when the sandbox loses its machine', () => {
		assert.equal(
			endedWith(SandboxState.STOPPED, null),
			LeaseEndReason.RELEASED
		);
		assert.equal(endedWith(SandboxState.ERROR, null), LeaseEndReason.RELEASED);
	});
});
