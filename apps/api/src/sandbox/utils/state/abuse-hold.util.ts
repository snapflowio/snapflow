/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SandboxLifecycle } from '@snapflow/machine-proto';
import type { Sandbox } from '../../entities/sandbox.entity';
import { SandboxDesiredState } from '../../enums/sandbox-desired-state.enum';
import { SandboxAbuseHoldException } from '../../exceptions/sandbox-abuse-hold.exception';
import { SandboxAbuseRestrictedException } from '../../exceptions/sandbox-abuse-restricted.exception';

type StartFields = Pick<Sandbox, 'desiredState' | 'runtimeLifecycle'>;

export function startsRuntime(
	previous: StartFields,
	next: StartFields
): boolean {
	return (
		(next.desiredState === SandboxDesiredState.STARTED &&
			previous.desiredState !== SandboxDesiredState.STARTED) ||
		(next.runtimeLifecycle === SandboxLifecycle.STARTED &&
			previous.runtimeLifecycle !== SandboxLifecycle.STARTED)
	);
}

export function assertAbuseHoldAllowsStart(
	previous: StartFields,
	next: StartFields & Pick<Sandbox, 'abuseHold'>
): void {
	if (next.abuseHold && startsRuntime(previous, next)) {
		throw new SandboxAbuseHoldException();
	}
}

export function assertSandboxCopyAllowed(
	sandbox: Pick<Sandbox, 'abuseHold' | 'abuseEgressBlock'>
): void {
	if (sandbox.abuseHold || sandbox.abuseEgressBlock) {
		throw new SandboxAbuseRestrictedException();
	}
}
