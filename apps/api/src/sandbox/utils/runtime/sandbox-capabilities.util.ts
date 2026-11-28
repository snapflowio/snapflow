/*
 * Copyright (c) 2026 Snapflow. All rights reserved.
 *
 * Snapflow is licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
 *
 * SPDX-License-Identifier: AGPL-3.0
 */

import { SandboxCapability } from '../../enums/sandbox-capability.enum';

const CAPABILITY_ORDER = [
	SandboxCapability.DEVELOPER_TOOLS,
	SandboxCapability.DESKTOP,
] as const;

export function normalizeSandboxCapabilities(
	capabilities: readonly SandboxCapability[] | undefined
): SandboxCapability[] {
	const normalized = new Set(capabilities ?? []);
	if (normalized.has(SandboxCapability.DESKTOP)) {
		normalized.add(SandboxCapability.DEVELOPER_TOOLS);
	}

	return CAPABILITY_ORDER.filter((capability) => normalized.has(capability));
}
