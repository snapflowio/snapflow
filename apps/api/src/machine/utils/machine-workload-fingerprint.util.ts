/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { createHash } from 'node:crypto';
import { canonicalJson } from '../../common/utils/canonical-json.util';
import type { SandboxCapability } from '../../sandbox/enums/sandbox-capability.enum';
import type { SandboxClass } from '../../sandbox/enums/sandbox-class.enum';
import type { SandboxMode } from '../../sandbox/enums/sandbox-mode.enum';

export interface MachineWorkloadIdentity {
	snapshot: string | null;
	sandboxClass: SandboxClass;
	mode: SandboxMode;
	capabilities: readonly SandboxCapability[];
	cpu: number;
	memoryGiB: number;
	diskGiB: number;
	gpu: number;
}

export function machineWorkloadFingerprint(
	identity: MachineWorkloadIdentity
): string {
	const canonicalIdentity = {
		...identity,
		capabilities: [...new Set(identity.capabilities)].sort(),
	};
	return `sha256:${createHash('sha256')
		.update(canonicalJson(canonicalIdentity))
		.digest('hex')}`;
}
